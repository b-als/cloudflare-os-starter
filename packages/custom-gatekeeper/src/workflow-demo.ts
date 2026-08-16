import {
  validateConflictRegisterArtifactV11,
  validateProcessGraphArtifactV11,
  validateRequirementsArtifactV11,
  validateSignoffPacketArtifactV11,
  validateTradeoffRegisterArtifactV11,
} from "./ba-schema.js";
import type { WorkflowStudioDemoV11 } from "./types.js";

export const WORKFLOW_STUDIO_DEMO_V11: WorkflowStudioDemoV11 = {
  contractVersion: "workflow-studio-demo/v1.1",
  processName: "Customer onboarding and risk review",
  requirements: {
    schemaVersion: "requirements/v1.1",
    processId: "proc-onboarding-001",
    generatedAt: "2026-08-13T00:00:00.000Z",
    stakeholders: [
      { id: "st-sales", name: "Sales Operations", role: "process-owner" },
      { id: "st-risk", name: "Risk and Compliance", role: "approver" },
      { id: "st-tech", name: "Platform Engineering", role: "delivery-lead" },
    ],
    requirements: [
      {
        id: "req-capture",
        title: "Capture onboarding request",
        category: "functional",
        statement: "Capture onboarding details from CRM and intake form.",
        acceptanceCriteria: ["Request is persisted with unique ID", "Requester is authenticated"],
        priority: "must",
        ownerStakeholderId: "st-sales",
        sourceStakeholderIds: ["st-sales"],
        fitCriterion: "95% of onboarding requests captured without manual re-entry.",
        benefitHypothesis: "Reduce intake cycle time and admin errors.",
      },
      {
        id: "req-risk-check",
        title: "Run risk triage decision",
        category: "compliance",
        statement: "Route high-risk customers to manual review and evidence capture.",
        acceptanceCriteria: ["Risk threshold applied", "Manual review decision stored"],
        priority: "must",
        ownerStakeholderId: "st-risk",
        sourceStakeholderIds: ["st-risk", "st-sales"],
        fitCriterion: "100% of high-risk customers receive manual review.",
        benefitHypothesis: "Reduce compliance incidents in onboarding.",
        dependencies: ["req-capture"],
      },
    ],
    raci: [
      {
        activityId: "act-intake",
        responsible: ["st-sales"],
        accountable: "st-tech",
        consulted: ["st-risk"],
        informed: ["st-sales"],
      },
      {
        activityId: "act-risk-review",
        responsible: ["st-risk"],
        accountable: "st-risk",
        consulted: ["st-tech"],
        informed: ["st-sales"],
      },
    ],
    decisionLog: [
      {
        id: "dec-routing-model",
        summary: "Adopt risk-based branch instead of universal manual review.",
        rationale: "Balances speed with mandatory control points.",
        requirementIds: ["req-capture", "req-risk-check"],
        ownerStakeholderId: "st-risk",
        status: "approved",
      },
    ],
  },
  conflictRegister: {
    schemaVersion: "conflicts/v1.1",
    processId: "proc-onboarding-001",
    conflicts: [
      {
        id: "conf-sla-vs-control",
        summary: "Sales requests same-day turnaround; risk requires manual review for high-risk.",
        requirementIds: ["req-capture", "req-risk-check"],
        stakeholderIds: ["st-sales", "st-risk"],
        impact: "timeline",
        resolutionOwnerStakeholderId: "st-risk",
        decision: { status: "resolved" },
      },
    ],
  },
  processGraph: {
    schemaVersion: "process-graph/v1.1",
    processId: "proc-onboarding-001",
    nodes: [
      { id: "n-start", type: "trigger", label: "Onboarding request received", swimlaneStakeholderId: "st-sales" },
      { id: "n-capture", type: "task", label: "Capture request", swimlaneStakeholderId: "st-sales", slaHours: 2 },
      { id: "n-risk", type: "decision", label: "High-risk customer?", swimlaneStakeholderId: "st-risk" },
      { id: "n-fast", type: "task", label: "Auto approve onboarding", swimlaneStakeholderId: "st-tech", slaHours: 1 },
      { id: "n-review", type: "approval", label: "Manual risk review", swimlaneStakeholderId: "st-risk", slaHours: 8 },
      { id: "n-end", type: "end", label: "Onboarding complete", swimlaneStakeholderId: "st-tech" },
    ],
    edges: [
      { id: "e-1", source: "n-start", target: "n-capture" },
      { id: "e-2", source: "n-capture", target: "n-risk" },
      { id: "e-3", source: "n-risk", target: "n-fast", condition: "no" },
      { id: "e-4", source: "n-risk", target: "n-review", condition: "yes" },
      { id: "e-5", source: "n-fast", target: "n-end" },
      { id: "e-6", source: "n-review", target: "n-end" },
    ],
  },
  tradeoffRegister: {
    schemaVersion: "tradeoffs/v1.1",
    processId: "proc-onboarding-001",
    preferredOptionId: "opt-balanced",
    options: [
      {
        id: "opt-speed",
        title: "Speed-first onboarding",
        summary: "Minimize checks to maximize conversion.",
        scores: { userValue: 5, deliveryEffort: 2, operationalRisk: 2, complianceFit: 2 },
        impacts: { scope: "low", cost: "low", timeline: "low", risk: "high" },
      },
      {
        id: "opt-balanced",
        title: "Risk-balanced onboarding",
        summary: "Use risk threshold to trigger targeted manual checks.",
        scores: { userValue: 4, deliveryEffort: 3, operationalRisk: 4, complianceFit: 5 },
        impacts: { scope: "medium", cost: "medium", timeline: "medium", risk: "low" },
      },
    ],
  },
  signoffPacket: {
    schemaVersion: "signoff/v1.1",
    processId: "proc-onboarding-001",
    baselineVersion: "baseline-2026-08-13-a",
    approvedAt: "2026-08-13T00:00:00.000Z",
    approvers: [
      { stakeholderId: "st-risk", role: "Risk Owner", decision: "approved" },
      {
        stakeholderId: "st-tech",
        role: "Platform Engineering Lead",
        decision: "approvedWithConditions",
        note: "Monitor review SLA weekly for first month.",
      },
    ],
  },
  viewer: {
    selectedRequirementId: "req-risk-check",
    highlightedConflictId: "conf-sla-vs-control",
    highlightedTradeoffOptionId: "opt-balanced",
  },
};

export function validateWorkflowStudioDemoV11(demo: WorkflowStudioDemoV11): string[] {
  const errors: string[] = [];
  if (demo.contractVersion !== "workflow-studio-demo/v1.1") {
    errors.push("contractVersion must be workflow-studio-demo/v1.1.");
  }

  const requirementsErrors = validateRequirementsArtifactV11(demo.requirements);
  const conflictErrors = validateConflictRegisterArtifactV11(demo.conflictRegister, { requirements: demo.requirements });
  const graphErrors = validateProcessGraphArtifactV11(demo.processGraph, { requirements: demo.requirements });
  const tradeoffErrors = validateTradeoffRegisterArtifactV11(demo.tradeoffRegister);
  const signoffErrors = validateSignoffPacketArtifactV11(demo.signoffPacket, { requirements: demo.requirements });
  errors.push(...requirementsErrors, ...conflictErrors, ...graphErrors, ...tradeoffErrors, ...signoffErrors);

  const requirementIds = new Set(demo.requirements.requirements.map((item) => item.id));
  if (!requirementIds.has(demo.viewer.selectedRequirementId)) {
    errors.push(`viewer.selectedRequirementId references unknown requirement ${demo.viewer.selectedRequirementId}`);
  }

  const conflictIds = new Set(demo.conflictRegister.conflicts.map((item) => item.id));
  if (!conflictIds.has(demo.viewer.highlightedConflictId)) {
    errors.push(
      `viewer.highlightedConflictId references unknown conflict ${demo.viewer.highlightedConflictId}`,
    );
  }

  const optionIds = new Set(demo.tradeoffRegister.options.map((item) => item.id));
  if (!optionIds.has(demo.viewer.highlightedTradeoffOptionId)) {
    errors.push(
      `viewer.highlightedTradeoffOptionId references unknown option ${demo.viewer.highlightedTradeoffOptionId}`,
    );
  }

  return errors;
}

/**
 * Builds a fresh, schema-valid starter bundle for a brand-new BA Studio
 * project: one placeholder in each artifact so cross-references in `viewer`
 * are valid. Shared by `BaUiApiImpl.createStarterBundle()` (sandboxed app /
 * Workflow Studio UI) and `CustomSessionImpl.createBaProject()` (agent-facing
 * `createBaProject` tool call) so both surfaces produce identical starter
 * content instead of maintaining two copies.
 */
export function buildStarterWorkflowStudioBundle(processId: string, processName: string): WorkflowStudioDemoV11 {
  const name = processName.trim().length > 0 ? processName.trim() : "Untitled process";
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
