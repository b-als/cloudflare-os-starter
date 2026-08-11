import { describe, expect, it } from "vitest";
import {
  CustomSessionImpl,
  applyPendingInvoiceApprovalAction,
  describeCustomAccount,
  describeCustomVendor,
} from "../src/custom.js";
import TYPES_CODE from "../src/types-code.js";

class MemoryDurableObjectStorage {
  readonly #map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.#map.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.#map.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.#map.delete(key);
  }

  async transaction<T>(callback: (txn: {
    get<U>(key: string): Promise<U | undefined>;
    put<U>(key: string, value: U): Promise<void>;
  }) => Promise<T>): Promise<T> {
    return callback({
      get: this.get.bind(this),
      put: this.put.bind(this),
    });
  }
}

function createSession() {
  const observations: { title: string; description: string }[] = [];
  const actions: {
    action: number;
    description: {
      title: string;
      description: string;
      implementsRevert: boolean;
      awaitDecision?: boolean;
    };
  }[] = [];
  const storage = new MemoryDurableObjectStorage();
  const queue = {
    async authorizeObservation(observation: { title: string; description: string }) {
      observations.push(observation);
    },
    async submitAction(action: number, description: {
      title: string;
      description: string;
      implementsRevert: boolean;
      awaitDecision?: boolean;
    }) {
      actions.push({ action, description });
    },
  };
  const session = new CustomSessionImpl(
    queue,
    storage as unknown as DurableObjectStorage,
  );
  return { session, storage, observations, actions };
}

describe("custom-gatekeeper", () => {
  it("describes the finance capability as an auto-provisioned singleton", () => {
    expect(describeCustomVendor()).toMatchObject({
      displayName: "Finance Operations",
      autoProvisionsAccount: true,
      providesAuth: false,
    });
    expect(describeCustomAccount()).toMatchObject({
      displayName: "Synthetic Finance Workspace",
      singleton: { tsType: "CustomSession" },
    });
  });

  it("exposes governed invoice operations to the agent", () => {
    expect(TYPES_CODE).toContain("listPendingInvoices");
    expect(TYPES_CODE).toContain("getInvoice");
    expect(TYPES_CODE).toContain("explainBlockedInvoice");
    expect(TYPES_CODE).toContain("requestInvoiceApproval");
    expect(TYPES_CODE).not.toContain("approveInvoice():");
  });

  it("lists deterministic synthetic invoices requiring attention", async () => {
    const { session } = createSession();
    const invoices = await session.listPendingInvoices();

    expect(invoices.map((invoice) => invoice.id)).toEqual([
      "INV-1042",
      "INV-1048",
      "INV-1051",
      "INV-1057",
    ]);
    expect(invoices.every((invoice) => invoice.status !== "approved")).toBe(true);
  });

  it("retrieves an individual invoice and handles unknown ids", async () => {
    const { session } = createSession();
    const invoice = await session.getInvoice("INV-1042");
    const missing = await session.getInvoice("INV-9999");

    expect(invoice?.id).toBe("INV-1042");
    expect(invoice?.status).toBe("awaiting_approval");
    expect(missing).toBeNull();
  });

  it("explains blocked reasons deterministically", async () => {
    const { session } = createSession();

    await expect(session.explainBlockedInvoice("INV-1048"))
      .resolves
      .toContain("No purchase order is attached.");
    await expect(session.explainBlockedInvoice("INV-1042"))
      .resolves
      .toContain("not blocked");
    await expect(session.explainBlockedInvoice("INV-9999"))
      .resolves
      .toContain("was not found");
  });

  it("submits governed actions without mutating invoice state before approval", async () => {
    const { session, actions } = createSession();

    const request = await session.requestInvoiceApproval("INV-1042");
    const beforeApply = await session.getInvoice("INV-1042");

    expect(request).toMatchObject({
      invoiceId: "INV-1042",
      submitted: true,
    });
    expect(beforeApply?.status).toBe("awaiting_approval");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: 1,
      description: {
        title: "Progress INV-1042 for approval",
        implementsRevert: false,
        awaitDecision: true,
      },
    });
  });

  it("applies submitted actions only when approval path calls applyAction", async () => {
    const { session, storage } = createSession();
    await session.requestInvoiceApproval("INV-1042");

    await applyPendingInvoiceApprovalAction(storage as unknown as DurableObjectStorage, 1);

    const invoice = await session.getInvoice("INV-1042");
    const pending = await session.listPendingInvoices();
    expect(invoice?.status).toBe("approved");
    expect(pending.map((item) => item.id)).not.toContain("INV-1042");
  });

  it("rejects unknown invoices and unknown action ids", async () => {
    const { session, storage } = createSession();

    await expect(session.requestInvoiceApproval("INV-9999")).rejects.toThrow("was not found");
    await expect(session.requestInvoiceApproval("INV-1048"))
      .rejects
      .toThrow("No purchase order is attached.");
    await expect(applyPendingInvoiceApprovalAction(storage as unknown as DurableObjectStorage, 404))
      .rejects
      .toThrow("Unknown invoice approval action 404.");
  });
});
