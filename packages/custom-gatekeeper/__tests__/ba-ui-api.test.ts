import { describe, expect, it } from "vitest";
import { BaUiApiImpl } from "../src/ba-ui-api.js";
import { validateWorkflowStudioDemoV11 } from "../src/workflow-demo.js";
import type { BaProjectDurableObject } from "../src/ba-project-store.js";
import type { BaProjectRegistryDurableObject } from "../src/ba-project-registry.js";
import type { WorkflowRunDurableObject } from "../src/workflow-run-store.js";
import type { BaProjectRecord, BaProjectSummary, WorkflowRunRecordV1 } from "../src/types.js";

/** An in-memory fake of the BaProjectDurableObject namespace, keyed by DO name (== processId). */
function createFakeBaProjects(): DurableObjectNamespace<BaProjectDurableObject> {
  const records = new Map<string, BaProjectRecord>();
  const stubFor = (name: string) => ({
    async getRecord(): Promise<BaProjectRecord | null> {
      return records.get(name) ?? null;
    },
    async saveBundle(processId: string, bundle: unknown): Promise<BaProjectRecord> {
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

/** An in-memory fake of the WorkflowRunDurableObject namespace, keyed by DO name (== processId). */
function createFakeWorkflowRuns(): DurableObjectNamespace<WorkflowRunDurableObject> {
  const runsByProject = new Map<string, WorkflowRunRecordV1[]>();
  const stubFor = (name: string) => ({
    async getRun(runId: string): Promise<WorkflowRunRecordV1 | null> {
      return (runsByProject.get(name) ?? []).find((run) => run.runId === runId) ?? null;
    },
    async listRuns(): Promise<WorkflowRunRecordV1[]> {
      return [...(runsByProject.get(name) ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    async putRun(run: WorkflowRunRecordV1): Promise<WorkflowRunRecordV1> {
      const existing = runsByProject.get(name) ?? [];
      const index = existing.findIndex((candidate) => candidate.runId === run.runId);
      if (index === -1) existing.push(run);
      else existing[index] = run;
      runsByProject.set(name, existing);
      return run;
    },
  });
  return {
    idFromName: (name: string) => name,
    get: (name: string) => stubFor(name),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

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

describe("BaUiApiImpl", () => {
  it("reports isAdmin as supplied at construction", async () => {
    const api = new BaUiApiImpl(true, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    expect(await api.isAdmin()).toBe(true);
  });

  it("returns null for a project with no saved bundle", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    expect(await api.getProject("proc-new")).toBeNull();
  });

  it("creates a valid starter bundle for a new project", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    const bundle = await api.createStarterBundle("proc-new", "New process");
    expect(bundle.processName).toBe("New process");
    expect(bundle.requirements.processId).toBe("proc-new");
    expect(validateWorkflowStudioDemoV11(bundle)).toEqual([]);
  });

  it("falls back to a default process name when blank", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    const bundle = await api.createStarterBundle("proc-new", "   ");
    expect(bundle.processName).toBe("Untitled process");
  });

  it("saves and reloads a project bundle, incrementing version", async () => {
    const projects = createFakeBaProjects();
    const api = new BaUiApiImpl(false, projects, createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    const starter = await api.createStarterBundle("proc-1", "Process one");
    const saved = await api.saveProject("proc-1", starter);
    expect(saved.version).toBe(1);

    const reloaded = await api.getProject("proc-1");
    expect(reloaded?.version).toBe(1);
    expect(reloaded?.bundle.processName).toBe("Process one");

    const savedAgain = await api.saveProject("proc-1", starter);
    expect(savedAgain.version).toBe(2);
  });

  it("rejects an empty processId", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    await expect(api.getProject("")).rejects.toThrow(/processId is required/);
  });

  it("lists no projects until one is saved or created, and syncs registry entries", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    await expect(api.listProjects()).resolves.toEqual([]);

    const starter = await api.createStarterBundle("proc-1", "Process one");
    await api.saveProject("proc-1", starter);
    const afterSave = await api.listProjects();
    expect(afterSave).toMatchObject([{ processId: "proc-1", processName: "Process one" }]);

    const created = await api.createProject("Process two");
    const afterCreate = await api.listProjects();
    expect(afterCreate).toHaveLength(2);
    expect(afterCreate.map((summary) => summary.processId)).toContain(created.processId);
  });

  it("createProject generates a fresh processId and a valid starter bundle", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    const record = await api.createProject("Customer Onboarding");
    expect(record.processId).toMatch(/^proc-customer-onboarding-/);
    expect(record.bundle.processName).toBe("Customer Onboarding");
    expect(validateWorkflowStudioDemoV11(record.bundle)).toEqual([]);
  });

  it("merges logged interview suggestions with gap-analysis suggestions, deduped by id", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
    const starter = await api.createStarterBundle("proc-1", "Process one");
    // The starter template's single requirement is "functional", which has no expected role
    // keywords, so add a compliance requirement with no matching stakeholder to trigger a gap,
    // plus a logged interview suggestion to confirm both sources are merged.
    const bundle = {
      ...starter,
      requirements: {
        ...starter.requirements,
        requirements: [
          ...starter.requirements.requirements,
          {
            id: "req-compliance",
            title: "Run a compliance check",
            category: "compliance" as const,
            statement: "Statement.",
            acceptanceCriteria: ["criterion"],
            priority: "must" as const,
            ownerStakeholderId: starter.requirements.stakeholders[0].id,
            sourceStakeholderIds: [starter.requirements.stakeholders[0].id],
            fitCriterion: "fit",
            benefitHypothesis: "benefit",
          },
        ],
        stakeholderSuggestions: [
          {
            id: "interview-1",
            name: "Priya",
            role: "Risk",
            reason: 'Mentioned as owning the decision during interview.',
            source: "interview" as const,
            suggestedAt: new Date().toISOString(),
          },
        ],
      },
    };
    const suggestions = await api.getStakeholderSuggestions(bundle);
    expect(suggestions.map((s) => s.id).sort()).toEqual(["gap-compliance", "interview-1"]);
  });

  describe("workflow runs", () => {
    it("throws when starting a run for a project with no saved bundle", async () => {
      const api = new BaUiApiImpl(false, createFakeBaProjects(), createFakeBaProjectRegistry(), createFakeWorkflowRuns());
      await expect(api.startWorkflowRun("proc-missing")).rejects.toThrow(/No saved BA Studio project/);
    });

    it("throws when starting a run for a project with no approved sign-off", async () => {
      const projects = createFakeBaProjects();
      const api = new BaUiApiImpl(false, projects, createFakeBaProjectRegistry(), createFakeWorkflowRuns());
      const starter = await api.createStarterBundle("proc-1", "Process one");
      await api.saveProject("proc-1", {
        ...starter,
        signoffPacket: { ...starter.signoffPacket, approvers: [{ ...starter.signoffPacket.approvers[0], decision: "rejected" }] },
      });
      await expect(api.startWorkflowRun("proc-1")).rejects.toThrow(/no approved decision/);
    });

    it("starts, lists, and advances a run through to completion", async () => {
      const projects = createFakeBaProjects();
      const api = new BaUiApiImpl(false, projects, createFakeBaProjectRegistry(), createFakeWorkflowRuns());
      const starter = await api.createStarterBundle("proc-1", "Process one");
      await api.saveProject("proc-1", starter);

      const run = await api.startWorkflowRun("proc-1", "test run");
      // the starter bundle's process graph is a simple start -> end with no decision/approval,
      // so the run should auto-complete immediately.
      expect(run.status).toBe("completed");
      expect(run.startedByNote).toBe("test run");

      const fetched = await api.getWorkflowRun("proc-1", run.runId);
      expect(fetched?.runId).toBe(run.runId);

      const list = await api.listWorkflowRuns("proc-1");
      expect(list.map((r) => r.runId)).toEqual([run.runId]);
    });

    it("throws when advancing a run that does not exist", async () => {
      const projects = createFakeBaProjects();
      const api = new BaUiApiImpl(false, projects, createFakeBaProjectRegistry(), createFakeWorkflowRuns());
      const starter = await api.createStarterBundle("proc-1", "Process one");
      await api.saveProject("proc-1", starter);
      await expect(api.advanceWorkflowRun("proc-1", "does-not-exist", {})).rejects.toThrow(/not found/);
    });
  });
});
