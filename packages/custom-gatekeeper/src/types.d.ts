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
}
