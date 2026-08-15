import { describe, expect, it } from "vitest";
import { BaUiApiImpl } from "../src/ba-ui-api.js";
import { validateWorkflowStudioDemoV11 } from "../src/workflow-demo.js";
import type { BaProjectDurableObject } from "../src/ba-project-store.js";
import type { BaProjectRecord } from "../src/types.js";

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

describe("BaUiApiImpl", () => {
  it("reports isAdmin as supplied at construction", async () => {
    const api = new BaUiApiImpl(true, createFakeBaProjects());
    expect(await api.isAdmin()).toBe(true);
  });

  it("returns null for a project with no saved bundle", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects());
    expect(await api.getProject("proc-new")).toBeNull();
  });

  it("creates a valid starter bundle for a new project", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects());
    const bundle = await api.createStarterBundle("proc-new", "New process");
    expect(bundle.processName).toBe("New process");
    expect(bundle.requirements.processId).toBe("proc-new");
    expect(validateWorkflowStudioDemoV11(bundle)).toEqual([]);
  });

  it("falls back to a default process name when blank", async () => {
    const api = new BaUiApiImpl(false, createFakeBaProjects());
    const bundle = await api.createStarterBundle("proc-new", "   ");
    expect(bundle.processName).toBe("Untitled process");
  });

  it("saves and reloads a project bundle, incrementing version", async () => {
    const projects = createFakeBaProjects();
    const api = new BaUiApiImpl(false, projects);
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
    const api = new BaUiApiImpl(false, createFakeBaProjects());
    await expect(api.getProject("")).rejects.toThrow(/processId is required/);
  });
});
