/** Information supplied by the organization operating this CloudflareOS deployment. */
export interface CustomDeploymentInfo {
  name: string;
  message: string;
}

/** JSON Schema document shape used for workflow artifacts. */
export interface JsonSchemaDocument {
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  title: string;
  type: "object";
  [key: string]: unknown;
}

/** Requirements artifact used by AI BA interviews and requirement synthesis. */
export interface RequirementsArtifactV1 {
  schemaVersion: "requirements/v1";
  processId: string;
  generatedAt: string;
  stakeholders: Array<{ id: string; name: string; role: string }>;
  requirements: Array<{
    id: string;
    title: string;
    category: "functional" | "nonFunctional" | "data" | "integration" | "compliance" | "reporting";
    statement: string;
    acceptanceCriteria: string[];
    priority: "must" | "should" | "could" | "wont";
    ownerStakeholderId: string;
    dependencies?: string[];
  }>;
}

/** Conflict register artifact used to resolve stakeholder and requirement contradictions. */
export interface ConflictRegisterArtifactV1 {
  schemaVersion: "conflicts/v1";
  processId: string;
  conflicts: Array<{
    id: string;
    summary: string;
    requirementIds: string[];
    stakeholderIds: string[];
    impact: "scope" | "cost" | "timeline" | "risk" | "compliance";
    decision: { status: "open" | "inReview" | "resolved" | "deferred" | "rejected" };
  }>;
}

/** Process graph artifact used by workflow visualization and execution planning. */
export interface ProcessGraphArtifactV1 {
  schemaVersion: "process-graph/v1";
  processId: string;
  nodes: Array<{
    id: string;
    type: "trigger" | "task" | "decision" | "integration" | "approval" | "end";
    label: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
  }>;
}

/** Bundle of v1 JSON schemas for BA-driven workflow design. */
export interface BusinessAnalysisSchemaBundleV1 {
  requirements: JsonSchemaDocument;
  conflictRegister: JsonSchemaDocument;
  processGraph: JsonSchemaDocument;
}

/** Requirement item with richer UK BA-oriented traceability fields. */
export interface RequirementItemV11 {
  id: string;
  title: string;
  category: "functional" | "nonFunctional" | "data" | "integration" | "compliance" | "reporting";
  statement: string;
  acceptanceCriteria: string[];
  priority: "must" | "should" | "could" | "wont";
  ownerStakeholderId: string;
  sourceStakeholderIds: string[];
  fitCriterion: string;
  benefitHypothesis: string;
  dependencies?: string[];
}

/**
 * A stakeholder someone mentioned during an interview (or that a gap check
 * inferred is missing) who has not yet been added to `stakeholders`. Purely
 * advisory: a human decides whether to actually invite/register them.
 */
export interface StakeholderSuggestionV11 {
  id: string;
  name?: string;
  role: string;
  reason: string;
  source: "interview" | "gapAnalysis";
  suggestedAt: string;
}

/** RACI mapping per activity in the process. */
export interface RaciAssignmentV11 {
  activityId: string;
  responsible: string[];
  accountable: string;
  consulted: string[];
  informed: string[];
}

/** Decision log entry that records requirement/process trade-off decisions. */
export interface DecisionLogEntryV11 {
  id: string;
  summary: string;
  rationale: string;
  requirementIds: string[];
  ownerStakeholderId: string;
  status: "proposed" | "approved" | "rejected" | "superseded";
}

/** Requirements artifact v1.1 with richer governance and traceability. */
export interface RequirementsArtifactV11 {
  schemaVersion: "requirements/v1.1";
  processId: string;
  generatedAt: string;
  stakeholders: Array<{ id: string; name: string; role: string }>;
  requirements: RequirementItemV11[];
  raci: RaciAssignmentV11[];
  decisionLog: DecisionLogEntryV11[];
  /** People flagged during interviews/analysis as worth consulting, but not yet registered. */
  stakeholderSuggestions?: StakeholderSuggestionV11[];
}

/** Conflict register v1.1 with explicit resolution ownership. */
export interface ConflictRegisterArtifactV11 {
  schemaVersion: "conflicts/v1.1";
  processId: string;
  conflicts: Array<{
    id: string;
    summary: string;
    requirementIds: string[];
    stakeholderIds: string[];
    impact: "scope" | "cost" | "timeline" | "risk" | "compliance";
    resolutionOwnerStakeholderId: string;
    decision: { status: "open" | "inReview" | "resolved" | "deferred" | "rejected" };
  }>;
}

/** Process graph v1.1 with stakeholder swimlanes and SLA hints. */
export interface ProcessGraphArtifactV11 {
  schemaVersion: "process-graph/v1.1";
  processId: string;
  nodes: Array<{
    id: string;
    type: "trigger" | "task" | "decision" | "integration" | "approval" | "end";
    label: string;
    swimlaneStakeholderId?: string;
    slaHours?: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
  }>;
}

/** Trade-off analysis artifact for process design options. */
export interface TradeoffRegisterArtifactV11 {
  schemaVersion: "tradeoffs/v1.1";
  processId: string;
  options: Array<{
    id: string;
    title: string;
    summary: string;
    scores: {
      userValue: number;
      deliveryEffort: number;
      operationalRisk: number;
      complianceFit: number;
    };
    impacts: {
      scope: "low" | "medium" | "high";
      cost: "low" | "medium" | "high";
      timeline: "low" | "medium" | "high";
      risk: "low" | "medium" | "high";
    };
  }>;
  preferredOptionId: string;
}

/** Final sign-off packet artifact for approved baselines. */
export interface SignoffPacketArtifactV11 {
  schemaVersion: "signoff/v1.1";
  processId: string;
  baselineVersion: string;
  approvedAt: string;
  approvers: Array<{
    stakeholderId: string;
    role: string;
    decision: "approved" | "approvedWithConditions" | "rejected";
    note?: string;
  }>;
}

/** Bundle of v1.1 JSON schemas for BA-led process modernization. */
export interface BusinessAnalysisSchemaBundleV11 {
  requirements: JsonSchemaDocument;
  conflictRegister: JsonSchemaDocument;
  processGraph: JsonSchemaDocument;
  tradeoffRegister: JsonSchemaDocument;
  signoffPacket: JsonSchemaDocument;
}

/** End-to-end workflow studio demo contract for viewer and editor integrations. */
export interface WorkflowStudioDemoV11 {
  contractVersion: "workflow-studio-demo/v1.1";
  processName: string;
  requirements: RequirementsArtifactV11;
  conflictRegister: ConflictRegisterArtifactV11;
  processGraph: ProcessGraphArtifactV11;
  tradeoffRegister: TradeoffRegisterArtifactV11;
  signoffPacket: SignoffPacketArtifactV11;
  viewer: {
    selectedRequirementId: string;
    highlightedConflictId: string;
    highlightedTradeoffOptionId: string;
  };
}

/** Status of a single process-graph node once a workflow run reaches it. */
export type WorkflowStepStatus =
  | "completed"
  | "skipped"
  | "waitingForDecision"
  | "waitingForApproval"
  | "failed";

/** Record of one process-graph node's execution within a workflow run. */
export interface WorkflowStepRecordV1 {
  nodeId: string;
  label: string;
  type: "trigger" | "task" | "decision" | "integration" | "approval" | "end";
  status: WorkflowStepStatus;
  enteredAt: string;
  resolvedAt?: string;
  /** For decision nodes: the edge condition chosen, once resolved. */
  chosenCondition?: string;
  /** For approval nodes: the human decision recorded, once resolved. */
  approvalDecision?: "approved" | "rejected";
  note?: string;
}

/** Overall status of a workflow run. */
export type WorkflowRunStatus = "running" | "waitingForInput" | "completed" | "failed";

/**
 * A durable, auditable execution of one BA Studio process's `processGraph`.
 * This is a *simulated* run: nodes complete automatically except `decision`
 * (needs a chosen edge condition) and `approval` (needs a human yes/no),
 * both supplied via `advanceWorkflowRun`. No gatekeeper/integration is
 * actually invoked yet -- this proves out the execution/audit-trail shape
 * ahead of wiring real actions to `task`/`integration` nodes.
 */
export interface WorkflowRunRecordV1 {
  runId: string;
  processId: string;
  baselineVersion: string;
  status: WorkflowRunStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  startedByNote?: string;
  steps: WorkflowStepRecordV1[];
  /** Node id currently awaiting a decision or approval, if `status` is `waitingForInput`. */
  pendingNodeId?: string;
}

/** BA Studio session mode. */
export type BaSessionMode = "interview" | "review" | "handoff";

/** Configuration supplied when initialising a BA Studio chat session. */
export interface BaSessionConfig {
  projectName: string;
  stakeholders: Array<{ name: string; role: string }>;
  mode: BaSessionMode;
  domainContext?: string;
}

/** Context produced for the Cloudflare OS agent turn loop at session start. */
export interface BaSessionContext {
  initialisedAt: string;
  config: BaSessionConfig;
  agentSystemPrompt: string;
  agentOpeningMessage: string;
}

/** A stored BA Studio project bundle with its monotonic version and last-write time. */
export interface BaProjectRecord {
  processId: string;
  version: number;
  updatedAt: string;
  bundle: WorkflowStudioDemoV11;
}

/**
 * Lightweight registry entry for a BA Studio project, used by project
 * list/selection UI so it does not need to load every project's full
 * artifact bundle just to show a picker.
 */
export interface BaProjectSummary {
  processId: string;
  processName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Example read-only capability provided to the CloudflareOS agent. */
export interface CustomSession {
  /** Returns the deployment's example information after recording an observation. */
  getDeploymentInfo(): Promise<CustomDeploymentInfo>;

  /** Returns v1 JSON schemas for requirements, conflict registers, and process graphs. */
  getBusinessAnalysisSchemaV1(): Promise<BusinessAnalysisSchemaBundleV1>;

  /** Returns v1.1 JSON schemas with MoSCoW, RACI, decision log, trade-off, and sign-off coverage. */
  getBusinessAnalysisSchemaV11(): Promise<BusinessAnalysisSchemaBundleV11>;

  /** Returns a validated end-to-end demo payload for workflow viewer and editor contracts. */
  getWorkflowStudioDemoV11(): Promise<WorkflowStudioDemoV11>;

  /**
   * Initialises a BA Studio chat session and returns the agent system prompt
   * and opening message. Call this at workspace open time to wire the agent
   * into BA interview, review, or handoff mode.
   */
  initialiseBaSession(config: BaSessionConfig): Promise<BaSessionContext>;

  /**
   * Returns the durably stored artifact bundle for a BA Studio project, or
   * null if nothing has been saved for this processId yet.
   */
  getBaProject(processId: string): Promise<BaProjectRecord | null>;

  /**
   * Validates and durably persists a new artifact bundle version for a BA
   * Studio project. Each project is stored in its own Durable Object so
   * projects scale independently of one another.
   */
  saveBaProject(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord>;

  /**
   * Lists summaries of every BA Studio project created on this deployment,
   * most recently updated first. Backs the BA Projects management page.
   */
  listBaProjects(): Promise<BaProjectSummary[]>;

  /**
   * Creates a new BA Studio project with a starter artifact bundle,
   * generating a unique `processId` from `processName`, and registers it so
   * it immediately appears in `listBaProjects()`.
   */
  createBaProject(processName: string): Promise<BaProjectRecord>;

  /**
   * Starts a new workflow run from the signed-off `processGraph` for a BA
   * Studio project. Requires the project's current `signoffPacket` to have
   * at least one approver whose decision is `approved` or
   * `approvedWithConditions` -- rejects otherwise. Returns the new run's
   * durable, versioned record.
   */
  startWorkflowRun(processId: string, note?: string): Promise<WorkflowRunRecordV1>;

  /**
   * Advances a `waitingForInput` workflow run past its pending decision or
   * approval node, then continues auto-completing subsequent nodes until
   * the run finishes or reaches the next node needing input.
   */
  advanceWorkflowRun(
    processId: string,
    runId: string,
    input: { condition?: string; approvalDecision?: "approved" | "rejected"; note?: string },
  ): Promise<WorkflowRunRecordV1>;

  /** Returns a single workflow run's current record, or null if it does not exist. */
  getWorkflowRun(processId: string, runId: string): Promise<WorkflowRunRecordV1 | null>;

  /** Lists all workflow runs recorded for a BA Studio project, most recent first. */
  listWorkflowRuns(processId: string): Promise<WorkflowRunRecordV1[]>;
}
