/**
 * BA Studio app UI capability.
 *
 * Implements the RPC surface exposed to the sandboxed BA Studio iframe (see
 * `packages/custom-gatekeeper/app/`). Wraps the same durable per-project
 * storage used by `CustomSessionImpl.getBaProject`/`saveBaProject`, so the
 * live UI and the agent-facing session capability always see the same data.
 */

import { RpcTarget } from "capnweb";
import type { BaProjectDurableObject } from "./ba-project-store.js";
import type { WorkflowRunDurableObject } from "./workflow-run-store.js";
import { findStakeholderGaps } from "./ba-schema.js";
import { buildStarterWorkflowStudioBundle } from "./workflow-demo.js";
import { advanceRun, assertSignedOff, buildNewRun } from "./workflow-run.js";
import { generateProcessId, type BaProjectRegistryDurableObject } from "./ba-project-registry.js";
import type {
  BaProjectRecord,
  BaProjectSummary,
  StakeholderSuggestionV11,
  WorkflowRunRecordV1,
  WorkflowStudioDemoV11,
} from "./types.js";
import type { BaUiApi } from "./ba-ui-types.js";

const MAX_PROCESS_ID_LENGTH = 256;

function validateProcessId(processId: string): void {
  if (typeof processId !== "string" || processId.trim().length === 0) {
    throw new Error("processId is required.");
  }
  if (processId.length > MAX_PROCESS_ID_LENGTH) {
    throw new Error(`processId is too long (max ${MAX_PROCESS_ID_LENGTH} characters).`);
  }
}

export class BaUiApiImpl extends RpcTarget implements BaUiApi {
  readonly #isAdmin: boolean;
  readonly #baProjects: DurableObjectNamespace<BaProjectDurableObject>;
  readonly #baProjectRegistry: DurableObjectNamespace<BaProjectRegistryDurableObject>;
  readonly #workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>;

  constructor(
    isAdmin: boolean,
    baProjects: DurableObjectNamespace<BaProjectDurableObject>,
    baProjectRegistry: DurableObjectNamespace<BaProjectRegistryDurableObject>,
    workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>,
  ) {
    super();
    this.#isAdmin = isAdmin;
    this.#baProjects = baProjects;
    this.#baProjectRegistry = baProjectRegistry;
    this.#workflowRuns = workflowRuns;
  }

  #registryStub() {
    return this.#baProjectRegistry.get(this.#baProjectRegistry.idFromName("global"));
  }

  async isAdmin(): Promise<boolean> {
    return this.#isAdmin;
  }

  async getProject(processId: string): Promise<BaProjectRecord | null> {
    validateProcessId(processId);
    const stub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    return stub.getRecord();
  }

  async saveProject(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord> {
    validateProcessId(processId);
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

  async listProjects(): Promise<BaProjectSummary[]> {
    return this.#registryStub().list();
  }

  async createProject(processName: string): Promise<BaProjectRecord> {
    const processId = generateProcessId(processName);
    const bundle = buildStarterWorkflowStudioBundle(processId, processName);
    return this.saveProject(processId, bundle);
  }

  async getStakeholderSuggestions(bundle: WorkflowStudioDemoV11): Promise<StakeholderSuggestionV11[]> {
    // Merge any suggestions the interview agent already logged into the bundle with a fresh
    // role-coverage gap check, deduping by id so a re-run doesn't pile up duplicates.
    const logged = bundle.requirements.stakeholderSuggestions ?? [];
    const gaps = findStakeholderGaps(bundle.requirements);
    const byId = new Map<string, StakeholderSuggestionV11>();
    for (const suggestion of [...logged, ...gaps]) {
      byId.set(suggestion.id, suggestion);
    }
    return [...byId.values()];
  }

  async startWorkflowRun(processId: string, note?: string): Promise<WorkflowRunRecordV1> {
    validateProcessId(processId);
    const projectStub = this.#baProjects.get(this.#baProjects.idFromName(processId));
    const record = await projectStub.getRecord();
    if (!record) {
      throw new Error(`No saved BA Studio project found for "${processId}".`);
    }
    assertSignedOff(record.bundle.signoffPacket);
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
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    return runsStub.getRun(runId);
  }

  async listWorkflowRuns(processId: string): Promise<WorkflowRunRecordV1[]> {
    validateProcessId(processId);
    const runsStub = this.#workflowRuns.get(this.#workflowRuns.idFromName(processId));
    return runsStub.listRuns();
  }

  async createStarterBundle(processId: string, processName: string): Promise<WorkflowStudioDemoV11> {
    validateProcessId(processId);
    return buildStarterWorkflowStudioBundle(processId, processName);
  }
}
