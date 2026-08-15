/**
 * BA Studio app UI capability.
 *
 * Implements the RPC surface exposed to the sandboxed BA Studio iframe (see
 * `packages/custom-gatekeeper/app/`). Wraps the same durable per-project
 * storage used by `CustomSessionImpl.getBaProject`/`saveBaProject`, so the
 * live UI and the agent-facing session capability always see the same data.
 */

import { RpcTarget } from "cloudflare:workers";
import type { BaProjectDurableObject } from "./ba-project-store.js";
import type { WorkflowRunDurableObject } from "./workflow-run-store.js";
import { findStakeholderGaps } from "./ba-schema.js";
import { validateWorkflowStudioDemoV11 } from "./workflow-demo.js";
import { advanceRun, assertSignedOff, buildNewRun } from "./workflow-run.js";
import type {
  BaProjectRecord,
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
  readonly #workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>;

  constructor(
    isAdmin: boolean,
    baProjects: DurableObjectNamespace<BaProjectDurableObject>,
    workflowRuns: DurableObjectNamespace<WorkflowRunDurableObject>,
  ) {
    super();
    this.#isAdmin = isAdmin;
    this.#baProjects = baProjects;
    this.#workflowRuns = workflowRuns;
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
    return stub.saveBundle(processId, bundle);
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
    const name = processName.trim().length > 0 ? processName.trim() : "Untitled process";
    // Seed one placeholder in each artifact so cross-references in `viewer` are valid; the BA
    // Studio UI expects these to be edited/replaced as the interview progresses.
    const bundle: WorkflowStudioDemoV11 = {
      contractVersion: "workflow-studio-demo/v1.1",
      processName: name,
      requirements: {
        schemaVersion: "requirements/v1.1",
        processId,
        generatedAt: new Date().toISOString(),
        stakeholders: [{ id: "st-owner", name: "Process owner", role: "process-owner" }],
        requirements: [
          {
            id: "req-001",
            title: "Describe the first requirement",
            category: "functional",
            statement: "Replace with a statement captured from stakeholder interviews.",
            acceptanceCriteria: ["Replace with acceptance criteria."],
            priority: "must",
            ownerStakeholderId: "st-owner",
            sourceStakeholderIds: ["st-owner"],
            fitCriterion: "Replace with a measurable fit criterion.",
            benefitHypothesis: "Replace with the expected benefit.",
          },
        ],
        raci: [],
        decisionLog: [],
      },
      conflictRegister: {
        schemaVersion: "conflicts/v1.1",
        processId,
        conflicts: [
          {
            id: "conf-001",
            summary: "Replace with a captured stakeholder conflict, or delete if none yet.",
            requirementIds: ["req-001"],
            stakeholderIds: ["st-owner"],
            impact: "scope",
            resolutionOwnerStakeholderId: "st-owner",
            decision: { status: "open" },
          },
        ],
      },
      processGraph: {
        schemaVersion: "process-graph/v1.1",
        processId,
        nodes: [
          { id: "n-start", type: "trigger", label: "Start" },
          { id: "n-end", type: "end", label: "End" },
        ],
        edges: [{ id: "e-start-end", source: "n-start", target: "n-end" }],
      },
      tradeoffRegister: {
        schemaVersion: "tradeoffs/v1.1",
        processId,
        options: [
          {
            id: "opt-001",
            title: "Option A",
            summary: "Replace with a candidate solution option.",
            scores: { userValue: 3, deliveryEffort: 3, operationalRisk: 3, complianceFit: 3 },
            impacts: { scope: "medium", cost: "medium", timeline: "medium", risk: "medium" },
          },
        ],
        preferredOptionId: "opt-001",
      },
      signoffPacket: {
        schemaVersion: "signoff/v1.1",
        processId,
        baselineVersion: "0.1.0",
        approvedAt: new Date().toISOString(),
        approvers: [
          {
            stakeholderId: "st-owner",
            role: "Process owner",
            decision: "approved",
            note: "Starter template auto-approval; replace once real sign-off is captured.",
          },
        ],
      },
      viewer: {
        selectedRequirementId: "req-001",
        highlightedConflictId: "conf-001",
        highlightedTradeoffOptionId: "opt-001",
      },
    };
    const errors = validateWorkflowStudioDemoV11(bundle);
    if (errors.length) {
      throw new Error(`Generated starter bundle is invalid: ${errors.join(" | ")}`);
    }
    return bundle;
  }
}
