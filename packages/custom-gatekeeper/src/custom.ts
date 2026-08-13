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
import { BUSINESS_ANALYSIS_SCHEMA_V1, BUSINESS_ANALYSIS_SCHEMA_V11 } from "./ba-schema.js";
import { WORKFLOW_STUDIO_DEMO_V11, validateWorkflowStudioDemoV11 } from "./workflow-demo.js";
import type {
  BusinessAnalysisSchemaBundleV1,
  BusinessAnalysisSchemaBundleV11,
  CustomDeploymentInfo,
  CustomSession,
  WorkflowStudioDemoV11,
} from "./types.js";
import TYPES_CODE from "./types-code.js";

const CUSTOM_ICON = {
  url:
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='none' stroke='currentColor' stroke-width='20'><path d='M52 72h152v112H52z'/><path d='m52 88 76 52 76-52'/></svg>",
    ),
};

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
  };
}

@validateRpc()
export class CustomSessionImpl extends RpcTarget implements CustomSession {
  readonly #approvalQueue: ObservationQueue;
  readonly #info: CustomDeploymentInfo;

  constructor(approvalQueue: ObservationQueue, info: CustomDeploymentInfo) {
    super();
    this.#approvalQueue = approvalQueue;
    this.#info = info;
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
    return new CustomSessionImpl(approvalQueue.dup(), {
      name: this.env.CUSTOM_NAME,
      message: this.env.CUSTOM_MESSAGE,
    });
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
