import { describe, expect, it } from "vitest";
import { buildNextRecord } from "../src/ba-project-store.js";
import { WORKFLOW_STUDIO_DEMO_V11 } from "../src/workflow-demo.js";
import type { WorkflowStudioDemoV11 } from "../src/types.js";

// buildNextRecord holds all of BaProjectDurableObject's validation and versioning logic. It is a
// pure function precisely so it can be exercised here without a real Workers/DurableObject
// runtime (constructing a DurableObject subclass directly requires a genuine DurableObjectState,
// which this vitest-pool-workers environment does not let plain test code fabricate).
describe("buildNextRecord", () => {
  const processId = WORKFLOW_STUDIO_DEMO_V11.processGraph.processId;

  it("rejects a bundle whose processGraph.processId does not match the project id", () => {
    expect(() => buildNextRecord("some-other-process", WORKFLOW_STUDIO_DEMO_V11, null)).toThrow(
      /does not match project/,
    );
  });

  it("rejects a bundle that fails v1.1 artifact schema validation", () => {
    const invalidBundle: WorkflowStudioDemoV11 = {
      ...WORKFLOW_STUDIO_DEMO_V11,
      viewer: { ...WORKFLOW_STUDIO_DEMO_V11.viewer, selectedRequirementId: "req-does-not-exist" },
    };
    expect(() => buildNextRecord(invalidBundle.processGraph.processId, invalidBundle, null)).toThrow(
      /is invalid/,
    );
  });

  it("builds version 1 when there is no previous record", () => {
    const record = buildNextRecord(processId, WORKFLOW_STUDIO_DEMO_V11, null);
    expect(record.processId).toBe(processId);
    expect(record.version).toBe(1);
    expect(record.bundle).toEqual(WORKFLOW_STUDIO_DEMO_V11);
    expect(record.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("increments the version when a previous record exists", () => {
    const first = buildNextRecord(processId, WORKFLOW_STUDIO_DEMO_V11, null);
    const second = buildNextRecord(processId, WORKFLOW_STUDIO_DEMO_V11, first);
    expect(second.version).toBe(2);
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.updatedAt).getTime(),
    );
  });
});
