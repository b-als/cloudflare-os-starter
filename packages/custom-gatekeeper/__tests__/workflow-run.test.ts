import { describe, expect, it } from "vitest";
import { WORKFLOW_STUDIO_DEMO_V11 } from "../src/workflow-demo.js";
import { advanceRun, assertSignedOff, buildNewRun } from "../src/workflow-run.js";
import type { ProcessGraphArtifactV11, SignoffPacketArtifactV11 } from "../src/types.js";

const graph = WORKFLOW_STUDIO_DEMO_V11.processGraph;
const processId = graph.processId;
const baselineVersion = WORKFLOW_STUDIO_DEMO_V11.signoffPacket.baselineVersion;

describe("assertSignedOff", () => {
  it("passes when at least one approver approved", () => {
    expect(() => assertSignedOff(WORKFLOW_STUDIO_DEMO_V11.signoffPacket)).not.toThrow();
  });

  it("throws when no approver has approved", () => {
    const packet: SignoffPacketArtifactV11 = {
      ...WORKFLOW_STUDIO_DEMO_V11.signoffPacket,
      approvers: [{ stakeholderId: "st-risk", role: "Risk Owner", decision: "rejected" }],
    };
    expect(() => assertSignedOff(packet)).toThrow(/no approved decision/);
  });

  it("throws when there are no approvers at all", () => {
    const packet: SignoffPacketArtifactV11 = { ...WORKFLOW_STUDIO_DEMO_V11.signoffPacket, approvers: [] };
    expect(() => assertSignedOff(packet)).toThrow(/no approved decision/);
  });
});

describe("buildNewRun", () => {
  it("runs from the trigger through the decision node and pauses for a decision", () => {
    const run = buildNewRun(processId, graph, baselineVersion, "kickoff note");
    expect(run.processId).toBe(processId);
    expect(run.baselineVersion).toBe(baselineVersion);
    expect(run.startedByNote).toBe("kickoff note");
    expect(run.status).toBe("waitingForInput");
    expect(run.pendingNodeId).toBe("n-risk");
    // trigger, capture both auto-complete; the decision node is recorded as waiting.
    expect(run.steps.map((s) => s.nodeId)).toEqual(["n-start", "n-capture", "n-risk"]);
    expect(run.steps.at(-1)?.status).toBe("waitingForDecision");
  });

  it("falls back to a no-incoming-edges node when the graph has no trigger node", () => {
    const noTriggerGraph: ProcessGraphArtifactV11 = {
      schemaVersion: "process-graph/v1.1",
      processId: "proc-simple",
      nodes: [
        { id: "n-a", type: "task", label: "A" },
        { id: "n-b", type: "end", label: "B" },
      ],
      edges: [{ id: "e-1", source: "n-a", target: "n-b" }],
    };
    const run = buildNewRun("proc-simple", noTriggerGraph, "0.1.0", undefined);
    expect(run.status).toBe("completed");
    expect(run.steps.map((s) => s.nodeId)).toEqual(["n-a", "n-b"]);
  });

  it("throws when the graph contains a cycle that never terminates", () => {
    const cyclicGraph: ProcessGraphArtifactV11 = {
      schemaVersion: "process-graph/v1.1",
      processId: "proc-cycle",
      nodes: [
        { id: "n-a", type: "trigger", label: "A" },
        { id: "n-b", type: "task", label: "B" },
      ],
      edges: [
        { id: "e-1", source: "n-a", target: "n-b" },
        { id: "e-2", source: "n-b", target: "n-a" },
      ],
    };
    expect(() => buildNewRun("proc-cycle", cyclicGraph, "0.1.0", undefined)).toThrow(/exceeded/);
  });
});

describe("advanceRun", () => {
  it("resolves a decision node, follows the matching condition, and pauses at the approval node", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const advanced = advanceRun(started, graph, { condition: "yes" });
    expect(advanced.status).toBe("waitingForInput");
    expect(advanced.pendingNodeId).toBe("n-review");
    const decisionStep = advanced.steps.find((s) => s.nodeId === "n-risk");
    expect(decisionStep?.status).toBe("completed");
    expect(decisionStep?.chosenCondition).toBe("yes");
  });

  it("resolves an approval node as approved and completes the run", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const afterDecision = advanceRun(started, graph, { condition: "yes" });
    const afterApproval = advanceRun(afterDecision, graph, { approvalDecision: "approved", note: "looks fine" });
    expect(afterApproval.status).toBe("completed");
    expect(afterApproval.completedAt).toBeDefined();
    expect(afterApproval.pendingNodeId).toBeUndefined();
    const approvalStep = afterApproval.steps.find((s) => s.nodeId === "n-review");
    expect(approvalStep?.status).toBe("completed");
    expect(approvalStep?.approvalDecision).toBe("approved");
    expect(approvalStep?.note).toBe("looks fine");
    // the end node should have been auto-completed after the approval.
    expect(afterApproval.steps.at(-1)?.nodeId).toBe("n-end");
  });

  it("resolves an approval node as rejected and fails the run without continuing", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const afterDecision = advanceRun(started, graph, { condition: "yes" });
    const rejected = advanceRun(afterDecision, graph, { approvalDecision: "rejected", note: "not ready" });
    expect(rejected.status).toBe("failed");
    expect(rejected.completedAt).toBeDefined();
    const approvalStep = rejected.steps.find((s) => s.nodeId === "n-review");
    expect(approvalStep?.status).toBe("failed");
    expect(approvalStep?.approvalDecision).toBe("rejected");
    // no n-end step should have been appended after a rejection.
    expect(rejected.steps.some((s) => s.nodeId === "n-end")).toBe(false);
  });

  it("follows the 'no' branch straight to auto-completion without an approval", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const advanced = advanceRun(started, graph, { condition: "no" });
    expect(advanced.status).toBe("completed");
    expect(advanced.steps.map((s) => s.nodeId)).toEqual(["n-start", "n-capture", "n-risk", "n-fast", "n-end"]);
  });

  it("throws when the run is not currently waiting for input", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const completed = advanceRun(started, graph, { condition: "no" });
    expect(() => advanceRun(completed, graph, { condition: "no" })).toThrow(/not waiting for input/);
  });

  it("throws when an approval node is given a non-approval input", () => {
    const started = buildNewRun(processId, graph, baselineVersion, undefined);
    const afterDecision = advanceRun(started, graph, { condition: "yes" });
    expect(() => advanceRun(afterDecision, graph, {})).toThrow(/requires approvalDecision/);
  });
});
