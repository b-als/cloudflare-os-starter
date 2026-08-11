import {
  DurableObject,
  RpcStub,
  RpcTarget,
  WorkerEntrypoint,
} from "cloudflare:workers";
import { skipRpcValidation, validateRpc } from "capnweb-validate";
import type {
  AccountDescription,
  ApprovalQueue,
  Gatekeeper,
  GatekeeperConnectCallback,
  GatekeeperConnectOptions,
  GatekeeperUser,
  GatekeeperUserVerifier,
  ResourceConfiguratorFrame,
  ResourceDescription,
  SupportedResource,
  VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import type { ApprovalRequest, CustomSession, Invoice } from "./types.js";
import TYPES_CODE from "./types-code.js";

const CUSTOM_ICON = {
  url:
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='none' stroke='currentColor' stroke-width='20'><rect x='44' y='40' width='168' height='176' rx='18'/><path d='M78 88h100M78 128h100M78 168h60'/><path d='m158 174 16 16 30-34'/></svg>",
    ),
};

const INVOICES_KEY = "product:synthetic-invoices";
const ACTION_COUNTER_KEY = "product:next-action-id";
const ACTION_PREFIX = "product:approval-action:";

const SYNTHETIC_INVOICES: Invoice[] = [
  {
    id: "INV-1042",
    supplier: "Northstar Components Ltd",
    amount: 28750,
    currency: "GBP",
    purchaseOrder: "PO-7712",
    owner: "Operations",
    status: "awaiting_approval",
    requiredApprover: "Finance Director",
  },
  {
    id: "INV-1048",
    supplier: "Apex Industrial Services",
    amount: 46200,
    currency: "GBP",
    purchaseOrder: null,
    owner: "Facilities",
    status: "blocked",
    blockedReason: "No purchase order is attached. Policy requires a valid PO before invoices above £10,000 can enter approval.",
    requiredApprover: "Finance Director",
  },
  {
    id: "INV-1051",
    supplier: "Meridian Logistics UK",
    amount: 18450,
    currency: "GBP",
    purchaseOrder: "PO-7738",
    owner: "Supply Chain",
    status: "awaiting_approval",
    requiredApprover: "Head of Finance",
  },
  {
    id: "INV-1057",
    supplier: "Vertex Consulting Group",
    amount: 73500,
    currency: "GBP",
    purchaseOrder: "PO-7744",
    owner: "Transformation",
    status: "blocked",
    blockedReason: "Invoice value exceeds the £50,000 delegated authority threshold and requires CFO approval before progression.",
    requiredApprover: "CFO",
  },
];

type ObservationQueue = Pick<ApprovalQueue, "authorizeObservation" | "submitAction"> &
  Partial<{ [Symbol.dispose](): void }>;

type PendingApprovalAction = {
  invoiceId: string;
};

async function loadInvoices(storage: DurableObjectStorage): Promise<Invoice[]> {
  const stored = await storage.get<Invoice[]>(INVOICES_KEY);
  if (stored) return stored;
  const seeded = SYNTHETIC_INVOICES.map((invoice) => ({ ...invoice }));
  await storage.put(INVOICES_KEY, seeded);
  return seeded;
}

export async function applyPendingInvoiceApprovalAction(
  storage: DurableObjectStorage,
  action: number,
): Promise<void> {
  const pending = await storage.get<PendingApprovalAction>(`${ACTION_PREFIX}${action}`);
  if (!pending) throw new Error(`Unknown invoice approval action ${action}.`);

  const invoices = await loadInvoices(storage);
  const index = invoices.findIndex((invoice) => invoice.id === pending.invoiceId);
  if (index < 0) throw new Error(`Invoice ${pending.invoiceId} was not found.`);

  invoices[index] = {
    ...invoices[index],
    status: "approved",
    blockedReason: undefined,
  };
  await storage.put(INVOICES_KEY, invoices);
  await storage.delete(`${ACTION_PREFIX}${action}`);
}

export function describeCustomVendor(): VendorDescription {
  return {
    displayName: "Finance Operations",
    url: "https://github.com/b-als/cloudflare-os-starter",
    logo: CUSTOM_ICON,
    color: "#eef4ff",
    tagline: "Inspect invoices and progress governed approvals",
    description:
      "A product-owned enterprise capability demonstrating how Cloudflare OS can inspect business data and request controlled workflow actions without giving the model direct write authority.",
    autoProvisionsAccount: true,
    providesAuth: false,
  };
}

export function describeCustomAccount(): AccountDescription {
  return {
    displayName: "Synthetic Finance Workspace",
    avatar: CUSTOM_ICON,
    singleton: { tsType: "CustomSession" },
  };
}

@validateRpc()
export class CustomSessionImpl extends RpcTarget implements CustomSession {
  readonly #approvalQueue: ObservationQueue;
  readonly #storage: DurableObjectStorage;

  constructor(approvalQueue: ObservationQueue, storage: DurableObjectStorage) {
    super();
    this.#approvalQueue = approvalQueue;
    this.#storage = storage;
  }

  async listPendingInvoices(): Promise<Invoice[]> {
    await this.#approvalQueue.authorizeObservation({
      title: "List pending invoices",
      description: "Read synthetic invoice records that currently require finance attention.",
    });
    const invoices = await loadInvoices(this.#storage);
    return invoices.filter((invoice) => invoice.status !== "approved");
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    await this.#approvalQueue.authorizeObservation({
      title: `Read invoice ${invoiceId}`,
      description: `Read the synthetic finance record and workflow state for invoice ${invoiceId}.`,
    });
    const invoices = await loadInvoices(this.#storage);
    return invoices.find((invoice) => invoice.id === invoiceId) ?? null;
  }

  async explainBlockedInvoice(invoiceId: string): Promise<string> {
    await this.#approvalQueue.authorizeObservation({
      title: `Explain invoice ${invoiceId}`,
      description: `Read the deterministic workflow reason affecting invoice ${invoiceId}.`,
    });
    const invoices = await loadInvoices(this.#storage);
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice) return `Invoice ${invoiceId} was not found.`;
    if (invoice.status === "approved") return `${invoiceId} is already approved.`;
    if (invoice.status !== "blocked") {
      return `${invoiceId} is not blocked. It is awaiting approval from ${invoice.requiredApprover}.`;
    }
    return invoice.blockedReason ?? `${invoiceId} is blocked by finance policy.`;
  }

  async requestInvoiceApproval(invoiceId: string): Promise<ApprovalRequest> {
    const invoices = await loadInvoices(this.#storage);
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} was not found.`);
    if (invoice.status === "approved") throw new Error(`Invoice ${invoiceId} is already approved.`);
    if (invoice.status === "blocked") {
      throw new Error(invoice.blockedReason ?? `Invoice ${invoiceId} is blocked by finance policy.`);
    }

    const actionId = await this.#storage.transaction(async (txn) => {
      const current = (await txn.get<number>(ACTION_COUNTER_KEY)) ?? 1;
      await txn.put(ACTION_COUNTER_KEY, current + 1);
      await txn.put<PendingApprovalAction>(`${ACTION_PREFIX}${current}`, { invoiceId });
      return current;
    });

    await this.#approvalQueue.submitAction(actionId, {
      title: `Progress ${invoiceId} for approval`,
      description:
        `Submit **${invoiceId}** from **${invoice.supplier}** for approval by **${invoice.requiredApprover}**.\n\n` +
        `Amount: **£${invoice.amount.toLocaleString("en-GB")}**\n\n` +
        `This synthetic action changes the invoice workflow state to approved only after the Cloudflare OS approval queue applies it.`,
      implementsRevert: false,
      awaitDecision: true,
    });

    return {
      invoiceId,
      submitted: true,
      message: `${invoiceId} has been submitted to the governed approval queue for ${invoice.requiredApprover}.`,
    };
  }

  [Symbol.dispose](): void {
    this.#approvalQueue[Symbol.dispose]?.();
  }
}

@validateRpc()
export class CustomGatekeeper extends DurableObject<Cloudflare.Env> implements Gatekeeper<CustomSession> {
  async describe(): Promise<ResourceDescription> {
    return {
      url: "product://finance/invoices",
      title: "Finance invoice workflow",
      snippet: "Synthetic invoices with governed approval progression.",
      suggestedBindingName: "FINANCE",
      tsType: "CustomSession",
    };
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }

  async getAutoApprovableActions(): Promise<[]> {
    return [];
  }

  async startSession(approvalQueue: RpcStub<ApprovalQueue>): Promise<CustomSession> {
    await loadInvoices(this.ctx.storage);
    return new CustomSessionImpl(approvalQueue.dup(), this.ctx.storage);
  }

  async addObserver(_id: string, _user: Fetcher<GatekeeperUserVerifier>): Promise<void> {}
  async removeObserver(_id: string): Promise<void> {}

  async applyAction(action: number): Promise<void> {
    await applyPendingInvoiceApprovalAction(this.ctx.storage, action);
  }

  async rejectAction(action: number): Promise<void> {
    await this.ctx.storage.delete(`${ACTION_PREFIX}${action}`);
  }

  async revertAction(_action: number): Promise<void> {
    throw new Error("Synthetic invoice approvals are not reversible in v0.2.");
  }
}

@validateRpc()
export class CustomAccount extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUser {
  async describe(): Promise<AccountDescription> {
    return describeCustomAccount();
  }

  async getSingletonGatekeeperClass(): Promise<DurableObjectClass<Gatekeeper<CustomSession>>> {
    return this.ctx.exports.CustomGatekeeper({});
  }

  async getSupportedResources(): Promise<SupportedResource[]> {
    return [];
  }

  getGatekeeperClassFor(_url: string): never {
    throw new Error("Finance Operations has no URL-addressed resources.");
  }

  startResourceConfigurator(_resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    throw new Error("Finance Operations has no URL-addressed resources.");
  }

  async ensureResources(_resourceUrlPatterns: string[]): Promise<{ url?: string }> {
    return {};
  }

  async revoke(): Promise<void> {}

  reconnect(): Promise<{ url: string }> {
    throw new Error("Finance Operations is auto-provisioned and has no reconnect flow.");
  }

  async getAuthenticatedEmail(): Promise<string | null> {
    return null;
  }

  @skipRpcValidation()
  async getVerifier(): Promise<Fetcher<GatekeeperUserVerifier>> {
    return this.ctx.exports.CustomVerifier({});
  }
}

@validateRpc()
export class CustomVerifier extends WorkerEntrypoint<Cloudflare.Env> implements GatekeeperUserVerifier {
  verify(): void {}
}

@validateRpc()
export class GatekeeperVendor extends WorkerEntrypoint<Cloudflare.Env> {
  async describe(): Promise<VendorDescription> {
    return describeCustomVendor();
  }

  @skipRpcValidation()
  async createAccount(): Promise<Fetcher<GatekeeperUser>> {
    return this.ctx.exports.CustomAccount({});
  }

  connectAccount(
    _callback: Fetcher<GatekeeperConnectCallback>,
    _options?: GatekeeperConnectOptions,
  ): Promise<{ url: string }> {
    throw new Error("Finance Operations is auto-provisioned and has no connect flow.");
  }

  async getSupportedResources(_options?: { userId?: string }): Promise<SupportedResource[]> {
    return [];
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }
}
