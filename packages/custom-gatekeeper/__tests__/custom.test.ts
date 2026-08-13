import { describe, expect, it } from "vitest";
import {
  CustomSessionImpl,
  describeCustomAccount,
  describeCustomVendor,
} from "../src/custom.js";
import {
  BUSINESS_ANALYSIS_SCHEMA_V1,
  BUSINESS_ANALYSIS_SCHEMA_V11,
  validateConflictRegisterArtifactV1,
  validateConflictRegisterArtifactV11,
  validateProcessGraphArtifactV1,
  validateProcessGraphArtifactV11,
  validateRequirementsArtifactV1,
  validateRequirementsArtifactV11,
  validateSignoffPacketArtifactV11,
  validateTradeoffRegisterArtifactV11,
} from "../src/ba-schema.js";
import { WORKFLOW_STUDIO_DEMO_V11, validateWorkflowStudioDemoV11 } from "../src/workflow-demo.js";

describe("custom-gatekeeper", () => {
  it("describes an auto-provisioned singleton", () => {
    expect(describeCustomVendor()).toMatchObject({
      displayName: "Custom Gatekeeper",
      autoProvisionsAccount: true,
      providesAuth: false,
    });
    expect(describeCustomAccount()).toMatchObject({
      displayName: "Custom Gatekeeper",
      singleton: { tsType: "CustomSession" },
    });
  });

  it("authorizes the observation before returning deployment information", async () => {
    let observation: unknown;
    let disposed = false;
    const session = new CustomSessionImpl(
      {
        authorizeObservation(value: unknown) {
          observation = value;
          return Promise.resolve();
        },
        [Symbol.dispose]() {
          disposed = true;
        },
      },
      { name: "Acme", message: "Use the internal handbook." },
    );

    await expect(session.getDeploymentInfo()).resolves.toEqual({
      name: "Acme",
      message: "Use the internal handbook.",
    });
    expect(observation).toEqual({
      title: "Read deployment information",
      description: "Read the custom information configured by this deployment.",
    });

    session[Symbol.dispose]();
    expect(disposed).toBe(true);
  });

  it("returns the business analysis schema bundle after recording an observation", async () => {
    let observation: unknown;
    const session = new CustomSessionImpl(
      {
        authorizeObservation(value: unknown) {
          observation = value;
          return Promise.resolve();
        },
      },
      { name: "Acme", message: "Use the internal handbook." },
    );

    await expect(session.getBusinessAnalysisSchemaV1()).resolves.toEqual(BUSINESS_ANALYSIS_SCHEMA_V1);
    expect(observation).toEqual({
      title: "Read business analysis schema",
      description: "Read the v1 JSON schemas for requirements, conflict registers, and process graphs.",
    });
  });

  it("returns the business analysis schema v1.1 bundle after recording an observation", async () => {
    let observation: unknown;
    const session = new CustomSessionImpl(
      {
        authorizeObservation(value: unknown) {
          observation = value;
          return Promise.resolve();
        },
      },
      { name: "Acme", message: "Use the internal handbook." },
    );

    await expect(session.getBusinessAnalysisSchemaV11()).resolves.toEqual(BUSINESS_ANALYSIS_SCHEMA_V11);
    expect(observation).toEqual({
      title: "Read business analysis schema v1.1",
      description:
        "Read the v1.1 JSON schemas for requirements, conflicts, process maps, trade-offs, and sign-off packets.",
    });
  });

  it("returns the workflow studio demo v1.1 bundle after validation and observation", async () => {
    let observation: unknown;
    const session = new CustomSessionImpl(
      {
        authorizeObservation(value: unknown) {
          observation = value;
          return Promise.resolve();
        },
      },
      { name: "Acme", message: "Use the internal handbook." },
    );

    await expect(session.getWorkflowStudioDemoV11()).resolves.toEqual(WORKFLOW_STUDIO_DEMO_V11);
    expect(observation).toEqual({
      title: "Read workflow studio demo v1.1",
      description:
        "Read a validated end-to-end BA artifact bundle for workflow viewer and editor integration.",
    });
  });

  it("validates requirements, conflicts, and process graph artifacts", () => {
    const requirements = {
      schemaVersion: "requirements/v1" as const,
      processId: "proc-1",
      generatedAt: "2026-08-13T00:00:00.000Z",
      stakeholders: [
        { id: "st-ops", name: "Operations", role: "process-owner" },
        { id: "st-risk", name: "Risk", role: "approver" },
      ],
      requirements: [
        {
          id: "req-1",
          title: "Capture request",
          category: "functional" as const,
          statement: "Capture incoming request details.",
          acceptanceCriteria: ["Request id generated", "Requester authenticated"],
          priority: "must" as const,
          ownerStakeholderId: "st-ops",
        },
        {
          id: "req-2",
          title: "Approval route",
          category: "compliance" as const,
          statement: "Route high-risk requests to approver.",
          acceptanceCriteria: ["Approver decision recorded"],
          priority: "should" as const,
          ownerStakeholderId: "st-risk",
          dependencies: ["req-1"],
        },
      ],
    };
    expect(validateRequirementsArtifactV1(requirements)).toEqual([]);

    const conflicts = {
      schemaVersion: "conflicts/v1" as const,
      processId: "proc-1",
      conflicts: [
        {
          id: "conf-1",
          summary: "Ops wants speed, risk wants additional checks.",
          requirementIds: ["req-1", "req-2"],
          stakeholderIds: ["st-ops", "st-risk"],
          impact: "timeline" as const,
          decision: { status: "inReview" as const },
        },
      ],
    };
    expect(validateConflictRegisterArtifactV1(conflicts, { requirements })).toEqual([]);

    const graph = {
      schemaVersion: "process-graph/v1" as const,
      processId: "proc-1",
      nodes: [
        { id: "n-start", type: "trigger" as const, label: "Request received" },
        { id: "n-check", type: "decision" as const, label: "High risk?" },
        { id: "n-fast", type: "task" as const, label: "Auto route" },
        { id: "n-approve", type: "approval" as const, label: "Manual approval" },
        { id: "n-end", type: "end" as const, label: "Completed" },
      ],
      edges: [
        { id: "e-1", source: "n-start", target: "n-check" },
        { id: "e-2", source: "n-check", target: "n-fast", condition: "no" },
        { id: "e-3", source: "n-check", target: "n-approve", condition: "yes" },
        { id: "e-4", source: "n-fast", target: "n-end" },
        { id: "e-5", source: "n-approve", target: "n-end" },
      ],
    };
    expect(validateProcessGraphArtifactV1(graph)).toEqual([]);
  });

  it("reports graph and dependency errors for broken artifacts", () => {
    const brokenRequirements = {
      schemaVersion: "requirements/v1" as const,
      processId: "proc-2",
      generatedAt: "2026-08-13T00:00:00.000Z",
      stakeholders: [{ id: "st-1", name: "Ops", role: "owner" }],
      requirements: [
        {
          id: "req-a",
          title: "A",
          category: "functional" as const,
          statement: "A",
          acceptanceCriteria: ["A"],
          priority: "must" as const,
          ownerStakeholderId: "unknown",
          dependencies: ["req-missing"],
        },
      ],
    };
    expect(validateRequirementsArtifactV1(brokenRequirements)).toEqual([
      "requirement req-a references unknown ownerStakeholderId unknown",
      "requirement req-a references unknown dependency req-missing",
    ]);

    const brokenGraph = {
      schemaVersion: "process-graph/v1" as const,
      processId: "proc-2",
      nodes: [
        { id: "n1", type: "decision" as const, label: "Branch?" },
        { id: "n1", type: "end" as const, label: "Done" },
      ],
      edges: [{ id: "e1", source: "n1", target: "n-missing" }],
    };
    expect(validateProcessGraphArtifactV1(brokenGraph)).toEqual([
      "duplicate node id: n1",
      "edge e1 references unknown target node n-missing",
      "process graph must contain at least one trigger node.",
      "decision node n1 must have at least two outgoing edges.",
      "decision node n1 requires a condition on each outgoing edge.",
    ]);
  });

  it("validates v1.1 requirements, conflicts, graph, trade-offs, and sign-off artifacts", () => {
    const requirementsV11 = {
      schemaVersion: "requirements/v1.1" as const,
      processId: "proc-11",
      generatedAt: "2026-08-13T00:00:00.000Z",
      stakeholders: [
        { id: "st-ops", name: "Operations", role: "process-owner" },
        { id: "st-risk", name: "Risk", role: "approver" },
        { id: "st-tech", name: "Technology", role: "delivery-lead" },
      ],
      requirements: [
        {
          id: "req-11-1",
          title: "Capture request",
          category: "functional" as const,
          statement: "Capture inbound request.",
          acceptanceCriteria: ["Request saved"],
          priority: "must" as const,
          ownerStakeholderId: "st-ops",
          sourceStakeholderIds: ["st-ops"],
          fitCriterion: "Captured in less than 2 minutes.",
          benefitHypothesis: "Reduced intake errors.",
        },
        {
          id: "req-11-2",
          title: "Risk review",
          category: "compliance" as const,
          statement: "Escalate high-risk cases.",
          acceptanceCriteria: ["Review decision logged"],
          priority: "should" as const,
          ownerStakeholderId: "st-risk",
          sourceStakeholderIds: ["st-risk", "st-ops"],
          fitCriterion: "All high-risk cases reviewed.",
          benefitHypothesis: "Lower compliance breaches.",
          dependencies: ["req-11-1"],
        },
      ],
      raci: [
        {
          activityId: "act-intake",
          responsible: ["st-ops"],
          accountable: "st-tech",
          consulted: ["st-risk"],
          informed: ["st-ops"],
        },
      ],
      decisionLog: [
        {
          id: "dec-1",
          summary: "Use risk-based routing.",
          rationale: "Balances speed and control.",
          requirementIds: ["req-11-1", "req-11-2"],
          ownerStakeholderId: "st-risk",
          status: "approved" as const,
        },
      ],
    };
    expect(validateRequirementsArtifactV11(requirementsV11)).toEqual([]);

    const conflictsV11 = {
      schemaVersion: "conflicts/v1.1" as const,
      processId: "proc-11",
      conflicts: [
        {
          id: "conf-11-1",
          summary: "Auto-approve vs manual review threshold.",
          requirementIds: ["req-11-1", "req-11-2"],
          stakeholderIds: ["st-ops", "st-risk"],
          impact: "risk" as const,
          resolutionOwnerStakeholderId: "st-risk",
          decision: { status: "inReview" as const },
        },
      ],
    };
    expect(validateConflictRegisterArtifactV11(conflictsV11, { requirements: requirementsV11 })).toEqual([]);

    const graphV11 = {
      schemaVersion: "process-graph/v1.1" as const,
      processId: "proc-11",
      nodes: [
        { id: "n-start", type: "trigger" as const, label: "Request received", swimlaneStakeholderId: "st-ops" },
        { id: "n-decision", type: "decision" as const, label: "High risk?", swimlaneStakeholderId: "st-risk" },
        { id: "n-fast", type: "task" as const, label: "Fast lane", swimlaneStakeholderId: "st-ops", slaHours: 2 },
        { id: "n-review", type: "approval" as const, label: "Risk review", swimlaneStakeholderId: "st-risk", slaHours: 8 },
        { id: "n-end", type: "end" as const, label: "Completed", swimlaneStakeholderId: "st-tech" },
      ],
      edges: [
        { id: "e-1", source: "n-start", target: "n-decision" },
        { id: "e-2", source: "n-decision", target: "n-fast", condition: "no" },
        { id: "e-3", source: "n-decision", target: "n-review", condition: "yes" },
        { id: "e-4", source: "n-fast", target: "n-end" },
        { id: "e-5", source: "n-review", target: "n-end" },
      ],
    };
    expect(validateProcessGraphArtifactV11(graphV11, { requirements: requirementsV11 })).toEqual([]);

    const tradeoffsV11 = {
      schemaVersion: "tradeoffs/v1.1" as const,
      processId: "proc-11",
      preferredOptionId: "opt-balanced",
      options: [
        {
          id: "opt-fast",
          title: "Speed-first",
          summary: "Minimal review checks.",
          scores: { userValue: 5, deliveryEffort: 2, operationalRisk: 2, complianceFit: 2 },
          impacts: { scope: "low" as const, cost: "low" as const, timeline: "low" as const, risk: "high" as const },
        },
        {
          id: "opt-balanced",
          title: "Balanced",
          summary: "Risk-based decision gate.",
          scores: { userValue: 4, deliveryEffort: 3, operationalRisk: 4, complianceFit: 5 },
          impacts: { scope: "medium" as const, cost: "medium" as const, timeline: "medium" as const, risk: "low" as const },
        },
      ],
    };
    expect(validateTradeoffRegisterArtifactV11(tradeoffsV11)).toEqual([]);

    const signoffV11 = {
      schemaVersion: "signoff/v1.1" as const,
      processId: "proc-11",
      baselineVersion: "baseline-1",
      approvedAt: "2026-08-13T00:00:00.000Z",
      approvers: [
        { stakeholderId: "st-risk", role: "Risk Owner", decision: "approved" as const },
        { stakeholderId: "st-tech", role: "Delivery Lead", decision: "approvedWithConditions" as const, note: "Monitor SLA in first month" },
      ],
    };
    expect(validateSignoffPacketArtifactV11(signoffV11, { requirements: requirementsV11 })).toEqual([]);
  });

  it("reports v1.1 governance and traceability validation errors", () => {
    const invalidRequirementsV11 = {
      schemaVersion: "requirements/v1.1" as const,
      processId: "proc-bad",
      generatedAt: "2026-08-13T00:00:00.000Z",
      stakeholders: [{ id: "st-1", name: "Ops", role: "owner" }],
      requirements: [
        {
          id: "req-a",
          title: "A",
          category: "functional" as const,
          statement: "A",
          acceptanceCriteria: ["A"],
          priority: "must" as const,
          ownerStakeholderId: "st-missing",
          sourceStakeholderIds: ["st-missing"],
          fitCriterion: "A",
          benefitHypothesis: "A",
          dependencies: ["req-missing"],
        },
      ],
      raci: [
        {
          activityId: "act-1",
          responsible: ["st-missing"],
          accountable: "st-missing",
          consulted: [],
          informed: [],
        },
      ],
      decisionLog: [
        {
          id: "dec-1",
          summary: "X",
          rationale: "Y",
          requirementIds: ["req-unknown"],
          ownerStakeholderId: "st-missing",
          status: "proposed" as const,
        },
      ],
    };
    expect(validateRequirementsArtifactV11(invalidRequirementsV11)).toEqual([
      "requirement req-a references unknown ownerStakeholderId st-missing",
      "requirement req-a references unknown source stakeholder st-missing",
      "requirement req-a references unknown dependency req-missing",
      "RACI activity act-1 references unknown accountable st-missing",
      "RACI activity act-1 references unknown stakeholder st-missing",
      "decision dec-1 references unknown ownerStakeholderId st-missing",
      "decision dec-1 references unknown requirement req-unknown",
    ]);

    const invalidTradeoffsV11 = {
      schemaVersion: "tradeoffs/v1.1" as const,
      processId: "proc-bad",
      preferredOptionId: "opt-x",
      options: [{ id: "opt-a", title: "A", summary: "A", scores: { userValue: 3, deliveryEffort: 3, operationalRisk: 3, complianceFit: 3 }, impacts: { scope: "low" as const, cost: "low" as const, timeline: "low" as const, risk: "low" as const } }],
    };
    expect(validateTradeoffRegisterArtifactV11(invalidTradeoffsV11)).toEqual([
      "preferredOptionId opt-x does not match any trade-off option id.",
    ]);
  });

  it("validates the workflow studio demo contract", () => {
    expect(validateWorkflowStudioDemoV11(WORKFLOW_STUDIO_DEMO_V11)).toEqual([]);
  });
});
