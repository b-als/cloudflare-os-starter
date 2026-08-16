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
import { createBaSessionContext, getBaSessionCatalogEntry } from "../src/ba-session.js";
import type { BaProjectDurableObject } from "../src/ba-project-store.js";
import type { BaProjectRegistryDurableObject } from "../src/ba-project-registry.js";
import type { BaProjectRecord, BaProjectSummary } from "../src/types.js";

/**
 * An in-memory fake of the BaProjectDurableObject namespace, keyed by DO name (== processId),
 * used to unit test CustomSessionImpl.getBaProject/saveBaProject without a real Workers runtime.
 */
function createFakeBaProjects(): DurableObjectNamespace<BaProjectDurableObject> {
  const records = new Map<string, BaProjectRecord>();
  const stubFor = (name: string) => ({
    async getRecord(): Promise<BaProjectRecord | null> {
      return records.get(name) ?? null;
    },
    async saveBundle(processId: string, bundle: unknown): Promise<BaProjectRecord> {
      const bundleProcessId = (bundle as { processGraph?: { processId?: string } }).processGraph
        ?.processId;
      if (bundleProcessId !== processId) {
        throw new Error(
          `Bundle processGraph.processId "${bundleProcessId}" does not match project "${processId}".`,
        );
      }
      const errors = validateWorkflowStudioDemoV11(bundle as WorkflowStudioDemoV11Like);
      if (errors.length) {
        throw new Error(`Workflow studio bundle is invalid: ${errors.join(" | ")}`);
      }
      const previous = records.get(name);
      const record: BaProjectRecord = {
        processId,
        version: (previous?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        bundle: bundle as BaProjectRecord["bundle"],
      };
      records.set(name, record);
      return record;
    },
  });
  return {
    idFromName: (name: string) => name,
    get: (name: string) => stubFor(name),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Local alias to avoid importing the full WorkflowStudioDemoV11 type just for structural validation.
type WorkflowStudioDemoV11Like = Parameters<typeof validateWorkflowStudioDemoV11>[0];

/** An in-memory fake of the BaProjectRegistryDurableObject singleton namespace. */
function createFakeBaProjectRegistry(): DurableObjectNamespace<BaProjectRegistryDurableObject> {
  const projects = new Map<string, BaProjectSummary>();
  const stub = {
    async list(): Promise<BaProjectSummary[]> {
      return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async upsert(summary: BaProjectSummary): Promise<void> {
      const existing = projects.get(summary.processId);
      projects.set(summary.processId, existing ? { ...summary, createdAt: existing.createdAt } : summary);
    },
  };
  return {
    idFromName: (name: string) => name,
    get: () => stub,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

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
      createFakeBaProjects(),
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
      createFakeBaProjects(),
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
      createFakeBaProjects(),
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
      createFakeBaProjects(),
    );

    await expect(session.getWorkflowStudioDemoV11()).resolves.toEqual(WORKFLOW_STUDIO_DEMO_V11);
    expect(observation).toEqual({
      title: "Read workflow studio demo v1.1",
      description:
        "Read a validated end-to-end BA artifact bundle for workflow viewer and editor integration.",
    });
  });

  describe("BA project storage", () => {
    const makeQueue = () => ({
      authorizeObservation(_obs: unknown) { return Promise.resolve(); },
    });

    it("returns null for a project that has never been saved, after authorizing observation", async () => {
      let observation: unknown;
      const session = new CustomSessionImpl(
        { authorizeObservation: (value: unknown) => { observation = value; return Promise.resolve(); } },
        { name: "Acme", message: "" },
        createFakeBaProjects(),
      );

      await expect(session.getBaProject("proc-unknown")).resolves.toBeNull();
      expect(observation).toEqual({
        title: "Read BA Studio project",
        description: 'Read the stored artifact bundle for BA Studio project "proc-unknown".',
      });
    });

    it("rejects an empty processId on read and write", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      await expect(session.getBaProject("")).rejects.toThrow("processId is required");
      await expect(session.saveBaProject("", WORKFLOW_STUDIO_DEMO_V11)).rejects.toThrow(
        "processId is required",
      );
    });

    it("saves a bundle and returns a versioned record, then reads it back", async () => {
      let observation: unknown;
      const processId = WORKFLOW_STUDIO_DEMO_V11.processGraph.processId;
      const session = new CustomSessionImpl(
        { authorizeObservation: (value: unknown) => { observation = value; return Promise.resolve(); } },
        { name: "Acme", message: "" },
        createFakeBaProjects(),
        createFakeBaProjectRegistry(),
      );

      const saved = await session.saveBaProject(processId, WORKFLOW_STUDIO_DEMO_V11);
      expect(saved.processId).toBe(processId);
      expect(saved.version).toBe(1);
      expect(saved.bundle).toEqual(WORKFLOW_STUDIO_DEMO_V11);
      expect(observation).toEqual({
        title: "Save BA Studio project",
        description: `Persist a new artifact bundle version for BA Studio project "${processId}".`,
      });

      const reloaded = await session.getBaProject(processId);
      expect(reloaded).toEqual(saved);

      const second = await session.saveBaProject(processId, WORKFLOW_STUDIO_DEMO_V11);
      expect(second.version).toBe(2);
    });

    it("rejects saving a bundle whose processGraph.processId does not match the target project", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      await expect(
        session.saveBaProject("some-other-process-id", WORKFLOW_STUDIO_DEMO_V11),
      ).rejects.toThrow(/does not match project/);
    });

    it("lists no projects until one is created, then lists it after saveBaProject and createBaProject", async () => {
      const registry = createFakeBaProjectRegistry();
      const session = new CustomSessionImpl(
        makeQueue(),
        { name: "Acme", message: "" },
        createFakeBaProjects(),
        registry,
      );

      await expect(session.listBaProjects()).resolves.toEqual([]);

      const processId = WORKFLOW_STUDIO_DEMO_V11.processGraph.processId;
      await session.saveBaProject(processId, WORKFLOW_STUDIO_DEMO_V11);
      const afterSave = await session.listBaProjects();
      expect(afterSave).toHaveLength(1);
      expect(afterSave[0]).toMatchObject({ processId, processName: WORKFLOW_STUDIO_DEMO_V11.processName });

      const created = await session.createBaProject("Untitled process");
      const afterCreate = await session.listBaProjects();
      expect(afterCreate).toHaveLength(2);
      expect(afterCreate.map((summary) => summary.processId)).toContain(created.processId);
    });

    it("createBaProject generates a fresh processId and a valid starter bundle", async () => {
      const session = new CustomSessionImpl(
        makeQueue(),
        { name: "Acme", message: "" },
        createFakeBaProjects(),
        createFakeBaProjectRegistry(),
      );

      const record = await session.createBaProject("Customer Onboarding");
      expect(record.processId).toMatch(/^proc-customer-onboarding-/);
      expect(record.bundle.processName).toBe("Customer Onboarding");
      expect(validateWorkflowStudioDemoV11(record.bundle as WorkflowStudioDemoV11Like)).toEqual([]);
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

  describe("BA session initialisation", () => {
    const makeQueue = () => ({
      authorizeObservation(_obs: unknown) { return Promise.resolve(); },
    });

    it("creates a BA interview session context with system prompt and opening message", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      const ctx = await session.initialiseBaSession({
        projectName: "Customer Onboarding Redesign",
        stakeholders: [
          { name: "Alice", role: "Product Owner" },
          { name: "Bob", role: "Risk Manager" },
        ],
        mode: "interview",
      });
      expect(ctx.config.projectName).toBe("Customer Onboarding Redesign");
      expect(ctx.config.mode).toBe("interview");
      expect(ctx.agentSystemPrompt).toContain("BA Studio");
      expect(ctx.agentSystemPrompt).toContain("Customer Onboarding Redesign");
      expect(ctx.agentSystemPrompt).toContain("Alice");
      expect(ctx.agentSystemPrompt).toContain("Bob");
      expect(ctx.agentOpeningMessage).toContain("Customer Onboarding Redesign");
      expect(ctx.initialisedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("creates a BA review session context", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      const ctx = await session.initialiseBaSession({
        projectName: "Risk Review Portal",
        stakeholders: [{ name: "Carol", role: "Compliance Lead" }],
        mode: "review",
      });
      expect(ctx.agentSystemPrompt).toContain("review");
      expect(ctx.agentOpeningMessage).toContain("review phase");
    });

    it("creates a BA handoff session context", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      const ctx = await session.initialiseBaSession({
        projectName: "Payments Modernisation",
        stakeholders: [],
        mode: "handoff",
      });
      expect(ctx.agentSystemPrompt).toContain("Workflow Handoff");
      expect(ctx.agentOpeningMessage).toContain("approved");
    });

    it("rejects an empty project name", async () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      await expect(
        session.initialiseBaSession({ projectName: "  ", stakeholders: [], mode: "interview" }),
      ).rejects.toThrow("non-empty projectName");
    });

    it("rejects an unknown session mode", () => {
      const session = new CustomSessionImpl(makeQueue(), { name: "Acme", message: "" }, createFakeBaProjects());
      // capnweb-validate rejects invalid union values synchronously before the method body runs.
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.initialiseBaSession({ projectName: "X", stakeholders: [], mode: "unknown" as any }),
      ).toThrow();
    });

    it("builds catalog entries for discovery", () => {
      const entry = getBaSessionCatalogEntry({
        projectName: "My Project",
        stakeholders: [{ name: "Alice", role: "PO" }],
        mode: "interview",
      });
      expect(entry.id).toBe("ba-session:my-project");
      expect(entry.title).toContain("My Project");
      expect(entry.title).toContain("Requirements Interview");
      expect(entry.description).toContain("Alice");
    });

    it("createBaSessionContext includes domain context in the system prompt", () => {
      const ctx = createBaSessionContext({
        projectName: "Claims Automation",
        stakeholders: [],
        mode: "interview",
        domainContext: "UK motor insurance, FCA regulated.",
      });
      expect(ctx.agentSystemPrompt).toContain("UK motor insurance");
    });
  });
});
