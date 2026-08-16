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
  AppUiContext,
  Gatekeeper,
  GatekeeperConnectCallback,
  GatekeeperConnectOptions,
  GatekeeperUiFrame,
  GatekeeperUser,
  GatekeeperUserVerifier,
  ResourceConfiguratorFrame,
  ResourceDescription,
  SupportedResource,
  VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import { BUSINESS_ANALYSIS_SCHEMA_V1, BUSINESS_ANALYSIS_SCHEMA_V11 } from "./ba-schema.js";
import { WORKFLOW_STUDIO_DEMO_V11, buildStarterWorkflowStudioBundle, validateWorkflowStudioDemoV11 } from "./workflow-demo.js";
import { createBaSessionContext } from "./ba-session.js";
import { BaUiApiImpl } from "./ba-ui-api.js";
import type { BaProjectDurableObject } from "./ba-project-store.js";
import { generateProcessId, type BaProjectRegistryDurableObject } from "./ba-project-registry.js";
import type { WorkflowRunDurableObject } from "./workflow-run-store.js";
import { advanceRun, assertSignedOff, buildNewRun } from "./workflow-run.js";
import type {
  BaProjectRecord,
  BaProjectSummary,
  BaSessionConfig,
  BaSessionContext,
  BusinessAnalysisSchemaBundleV1,
  BusinessAnalysisSchemaBundleV11,
  CustomDeploymentInfo,
  CustomSession,
  WorkflowRunRecordV1,
  WorkflowStudioDemoV11,
} from "./types.js";
import TYPES_CODE from "./types-code.js";
import APP_HTML from "./generated/app.txt";

const CUSTOM_ICON = {
  url:
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='none' stroke='currentColor' stroke-width='20'><path d='M52 72h152v112H52z'/><path d='m52 88 76 52 76-52'/></svg>",
    ),
};

const MAX_PROCESS_ID_LENGTH = 256;

/** Validates a processId before using it as a Durable Object name. */
function validateProcessId(processId: string): void {
  if (typeof processId !== "string" || processId.trim().length === 0) {
    throw new Error("processId is required.");
  }
  if (processId.length > MAX_PROCESS_ID_LENGTH) {
    throw new Error(`processId is too long (max ${MAX_PROCESS_ID_LENGTH} characters).`);
  }
}

type ObservationQueue = Pick<ApprovalQueue, "authorizeObservation"> &
  Partial<{ [Symbol.dispose](): void }>;

export function describeCustomVendor(): VendorDescription {
  return {
    displayName: "Custom Gatekeeper",
    url: "https://github.com/cloudflare/cloudflare-os-starter",
    logo: CUSTOM_ICON,
    color: "#e8f2ff",
    tagline: "Example organization-specific capability",
    description:
      "A minimal Gatekeeper to copy when connecting CloudflareOS to your organization's systems.",
    autoProvisionsAccount: true,
    providesAuth: false,
  };
}

export function describeCustomAccount(): AccountDescription {
  return {
    displayName: "Custom Gatekeeper",
    avatar: CUSTOM_ICON,
    singleton: { tsType: "CustomSession" },
    providesUi: { title: "BA Studio", icon: CUSTOM_ICON },
  };
}

@validateRpc()
export class CustomSessionImpl extends RpcTarget implements CustomSession {
  readonly #approvalQueue: ObservationQueue;
  readonly #info: CustomDeploymentInfo;
  readonly #baProjects: DurableObjectNamespace<BaProjectDurableObject>;
  readonly #baProjectRegistry: DurableObjectNamespace<BaProjectRegistryDurableObject>;
  readonly #workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>;

  constructor(
    approvalQueue: ObservationQueue,
    info: CustomDeploymentInfo,
    baProjects: DurableObjectNamespace<BaProjectDurableObject>,
    baProjectRegistry: DurableObjectNamespace<BaProjectRegistryDurableObject>,
    workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>,
  ) {
    super();
    this.#approvalQueue = approvalQueue;
    this.#info = info;
    this.#baProjects = baProjects;
    this.#baProjectRegistry = baProjectRegistry;
    this.#workflowRuns = workflowRuns;
  }

  #registryStub() {
    return this.#baProjectRegistry.get(this.#baProjectRegistry.idFromName("global"));
  }

  async getDeploymentInfo(): Promise<CustomDeploymentInfo> {
    await this.#approvalQueue.authorizeObservation({
      title: "Read deployment information",
      description: "Read the custom information configured by this deployment.",
    });
    return this.#info;
  }

  async getBusinessAnalysisSchemaV1(): Promise<BusinessAnalysisSchemaBundleV1> {
    await this.#approvalQueue.authorizeObservation({
      title: "Read business analysis schema",
      description: "Read the v1 JSON schemas for requirements, conflict registers, and process graphs.",
    });
    return BUSINESS_ANALYSIS_SCHEMA_V1;
  }

  async getBusinessAnalysisSchemaV11(): Promise<BusinessAnalysisSchemaBundleV11> {
    await this.#approvalQueue.authorizeObservation({
      title: "Read business analysis schema v1.1",
      description:
        "Read the v1.1 JSON schemas for requirements, conflicts, process maps, trade-offs, and sign-off packets.",
    });
    return BUSINESS_ANALYSIS_SCHEMA_V11;
  }

  async getWorkflowStudioDemoV11(): Promise<WorkflowStudioDemoV11> {
    await this.#approvalQueue.authorizeObservation({
      title: "Read workflow studio demo v1.1",
      description:
        "Read a validated end-to-end BA artifact bundle for workflow viewer and editor integration.",
    });
    const errors = validateWorkflowStudioDemoV11(WORKFLOW_STUDIO_DEMO_V11);
    if (errors.length) {
      throw new Error(`Workflow studio demo v1.1 is invalid: ${errors.join(" | ")}`);
    }
    return WORKFLOW_STUDIO_DEMO_V11;
  }

  async initialiseBaSession(config: BaSessionConfig): Promise<BaSessionContext> {
    await this.#approvalQueue.authorizeObservation({
      title: "Initialise BA Studio session",
      description: `Initialise a BA ${config.mode} session for project "${config.projectName}" with ${config.stakeholders.length} stakeholder(s).`,
    });
    if (!config.projectName || config.projectName.trim().length === 0) {
      throw new Error("BA session initialisation requires a non-empty projectName.");
    }
    if (!["interview", "review", "handoff"].includes(config.mode)) {
      throw new Error(`Unknown BA session mode: ${config.mode}`);
    }
    return createBaSessionContext(config);
  }

  async getBaProject(processId: string): Promise<BaProjectRecord | null> {
    validateProcessId(processId);
    await this.#approvalQueue.authorizeObservation({
      title: "Read BA Studio project",
      description: `Read the stored artifact bundle for BA Studio project "${processId}".`,
    });
    const stub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    return stub.getRecord();
  }

  async saveBaProject(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord> {
    validateProcessId(processId);
    await this.#approvalQueue.authorizeObservation({
      title: "Save BA Studio project",
      description: `Persist a new artifact bundle version for BA Studio project "${processId}".`,
    });
    return this.#persistBundle(processId, bundle);
  }

  async listBaProjects(): Promise<BaProjectSummary[]> {
    await this.#approvalQueue.authorizeObservation({
      title: "List BA Studio projects",
      description: "List summaries of every BA Studio project on this deployment.",
    });
    return this.#registryStub().list();
  }

  async createBaProject(processName: string): Promise<BaProjectRecord> {
    await this.#approvalQueue.authorizeObservation({
      title: "Create BA Studio project",
      description: `Create a new BA Studio project "${processName}" with a starter artifact bundle.`,
    });
    const processId = generateProcessId(processName);
    const bundle = buildStarterWorkflowStudioBundle(processId, processName);
    return this.#persistBundle(processId, bundle);
  }

  /** Saves a bundle to its project Durable Object, then syncs the registry entry. */
  async #persistBundle(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord> {
    const stub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    const record = await stub.saveBundle(processId, bundle);
    await this.#registryStub().upsert({
      processId,
      processName: record.bundle.processName,
      version: record.version,
      createdAt: record.updatedAt,
      updatedAt: record.updatedAt,
    });
    return record;
  }

  async startWorkflowRun(processId: string, note?: string): Promise<WorkflowRunRecordV1> {
    validateProcessId(processId);
    const projectStub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    const record = await projectStub.getRecord();
    if (!record) {
      throw new Error(`No saved BA Studio project found for "${processId}".`);
    }
    assertSignedOff(record.bundle.signoffPacket);
    await this.#approvalQueue.authorizeObservation({
      title: "Start workflow run",
      description: `Start executing the signed-off process graph for BA Studio project "${processId}" (baseline ${record.bundle.signoffPacket.baselineVersion}).`,
    });
    const run = buildNewRun(processId, record.bundle.processGraph, record.bundle.signoffPacket.baselineVersion, note);
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    return runsStub.putRun(run);
  }

  async advanceWorkflowRun(
    processId: string,
    runId: string,
    input: { condition?: string; approvalDecision?: "approved" | "rejected"; note?: string },
  ): Promise<WorkflowRunRecordV1> {
    validateProcessId(processId);
    await this.#approvalQueue.authorizeObservation({
      title: "Advance workflow run",
      description: `Resolve the pending step of workflow run "${runId}" for BA Studio project "${processId}".`,
    });
    const projectStub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    const record = await projectStub.getRecord();
    if (!record) {
      throw new Error(`No saved BA Studio project found for "${processId}".`);
    }
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    const run = await runsStub.getRun(runId);
    if (!run) {
      throw new Error(`Workflow run "${runId}" not found for project "${processId}".`);
    }
    const advanced = advanceRun(run, record.bundle.processGraph, input);
    return runsStub.putRun(advanced);
  }

  async getWorkflowRun(processId: string, runId: string): Promise<WorkflowRunRecordV1 | null> {
    validateProcessId(processId);
    await this.#approvalQueue.authorizeObservation({
      title: "Read workflow run",
      description: `Read workflow run "${runId}" for BA Studio project "${processId}".`,
    });
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    return runsStub.getRun(runId);
  }

  async listWorkflowRuns(processId: string): Promise<WorkflowRunRecordV1[]> {
    validateProcessId(processId);
    await this.#approvalQueue.authorizeObservation({
      title: "List workflow runs",
      description: `List all workflow runs recorded for BA Studio project "${processId}".`,
    });
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    return runsStub.listRuns();
  }

  [Symbol.dispose](): void {
    this.#approvalQueue[Symbol.dispose]?.();
  }
}

@validateRpc()
export class CustomGatekeeper extends DurableObject<Cloudflare.Env> implements Gatekeeper<CustomSession> {
  async describe(): Promise<ResourceDescription> {
    return {
      url: "custom://deployment-info",
      title: "Deployment information",
      snippet: "Organization-specific information supplied by this deployment.",
      suggestedBindingName: "CUSTOM",
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
    return new CustomSessionImpl(
      approvalQueue.dup(),
      {
        name: this.env.CUSTOM_NAME,
        message: this.env.CUSTOM_MESSAGE,
      },
      this.ctx.exports.BaProjectDurableObject,
      this.ctx.exports.BaProjectRegistryDurableObject,
      this.ctx.exports.WorkflowRunDurableObject,
    );
  }

  async addObserver(_id: string, _user: Fetcher<GatekeeperUserVerifier>): Promise<void> {}
  async removeObserver(_id: string): Promise<void> {}

  async applyAction(action: number): Promise<void> {
    throw new Error(`Custom Gatekeeper has no actions (${action}).`);
  }

  async rejectAction(_action: number): Promise<void> {}

  async revertAction(_action: number): Promise<void> {
    throw new Error("Custom Gatekeeper has no actions to revert.");
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

  async startAppUi(context: AppUiContext): Promise<GatekeeperUiFrame> {
    // Hand the sandboxed BA Studio iframe its own capability. isAdmin is supplied fresh per open.
    const ui = new RpcStub(
      new BaUiApiImpl(
        context.isAdmin,
        this.ctx.exports.BaProjectDurableObject,
        this.ctx.exports.BaProjectRegistryDurableObject,
        this.ctx.exports.WorkflowRunDurableObject,
      ),
    );
    return { iframeHtml: APP_HTML, ui };
  }

  async getSupportedResources(): Promise<SupportedResource[]> {
    return [];
  }

  getGatekeeperClassFor(_url: string): never {
    throw new Error("Custom Gatekeeper has no URL-addressed resources.");
  }

  startResourceConfigurator(_resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    throw new Error("Custom Gatekeeper has no URL-addressed resources.");
  }

  async ensureResources(_resourceUrlPatterns: string[]): Promise<{ url?: string }> {
    return {};
  }

  async revoke(): Promise<void> {}

  reconnect(): Promise<{ url: string }> {
    throw new Error("Custom Gatekeeper has no credentials to reconnect.");
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
    throw new Error("Custom Gatekeeper is auto-provisioned and has no connect flow.");
  }

  async getSupportedResources(_options?: { userId?: string }): Promise<SupportedResource[]> {
    return [];
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }
}
