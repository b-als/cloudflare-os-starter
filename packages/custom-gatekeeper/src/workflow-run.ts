/**
 * BA Studio — workflow run execution (Phase 3).
 *
 * Executes a signed-off `processGraph` as a durable, auditable run. This is
 * intentionally a *simulation*: `task`/`trigger`/`integration`/`end` nodes
 * auto-complete immediately, while `decision` nodes wait for a chosen edge
 * condition and `approval` nodes wait for a human yes/no -- both supplied
 * through `advanceWorkflowRun`. No gatekeeper/integration is actually
 * invoked yet. This proves out the run/audit-trail shape (start, resume,
 * complete, fail) so real actions can be wired to `task`/`integration`
 * nodes later without changing the run record shape or the sign-off gate.
 */

import type {
  ProcessGraphArtifactV11,
  SignoffPacketArtifactV11,
  WorkflowRunRecordV1,
  WorkflowStepRecordV1,
} from "./types.js";

const MAX_STEPS_PER_RUN = 500;

/**
 * A signed-off process may still contain `rejected` or missing decisions if
 * the BA overrode a conflict; the only thing that gates execution is that at
 * least one approver has actually approved (with or without conditions).
 */
export function assertSignedOff(signoffPacket: SignoffPacketArtifactV11): void {
  const hasApproval = signoffPacket.approvers.some(
    (approver) => approver.decision === "approved" || approver.decision === "approvedWithConditions",
  );
  if (!hasApproval) {
    throw new Error(
      `Process cannot be run: sign-off packet for baseline ${signoffPacket.baselineVersion} has no approved decision.`,
    );
  }
}

function findNode(graph: ProcessGraphArtifactV11, nodeId: string) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new Error(`Process graph node ${nodeId} not found.`);
  }
  return node;
}

function findStartNode(graph: ProcessGraphArtifactV11) {
  const trigger = graph.nodes.find((node) => node.type === "trigger");
  if (trigger) return trigger;
  // Fall back to a node with no incoming edges, then the first node, so graphs authored
  // without an explicit trigger node can still be executed.
  const targets = new Set(graph.edges.map((edge) => edge.target));
  const noIncoming = graph.nodes.find((node) => !targets.has(node.id));
  if (noIncoming) return noIncoming;
  if (graph.nodes.length === 0) {
    throw new Error("Process graph has no nodes to execute.");
  }
  return graph.nodes[0];
}

/** Picks the outgoing edge to follow from `nodeId`, given an optional decision condition. */
function nextEdge(graph: ProcessGraphArtifactV11, nodeId: string, condition?: string) {
  const outgoing = graph.edges.filter((edge) => edge.source === nodeId);
  if (outgoing.length === 0) return null;
  if (outgoing.length === 1) return outgoing[0];
  if (condition) {
    const matched = outgoing.find((edge) => edge.condition === condition);
    if (matched) return matched;
  }
  throw new Error(
    `Node ${nodeId} has multiple outgoing edges (${outgoing.map((edge) => edge.condition ?? "<no condition>").join(", ")}) and no matching condition was supplied.`,
  );
}

/**
 * Runs the graph forward from `fromNodeId` (inclusive), auto-completing
 * nodes until it reaches a `decision`/`approval` node that needs input, an
 * `end` node, or a dead end (no outgoing edge). Mutates `steps` in place by
 * appending new step records; returns the run's terminal status.
 */
function runForward(
  graph: ProcessGraphArtifactV11,
  fromNodeId: string,
  steps: WorkflowStepRecordV1[],
): { status: "completed" | "waitingForInput" | "failed"; pendingNodeId?: string } {
  let currentId: string | null = fromNodeId;
  let guard = 0;
  while (currentId) {
    if (++guard > MAX_STEPS_PER_RUN) {
      throw new Error(`Workflow run exceeded ${MAX_STEPS_PER_RUN} steps -- the process graph may contain a cycle.`);
    }
    const node = findNode(graph, currentId);
    const now = new Date().toISOString();

    if (node.type === "decision" || node.type === "approval") {
      steps.push({
        nodeId: node.id,
        label: node.label,
        type: node.type,
        status: node.type === "decision" ? "waitingForDecision" : "waitingForApproval",
        enteredAt: now,
      });
      return { status: "waitingForInput", pendingNodeId: node.id };
    }

    steps.push({ nodeId: node.id, label: node.label, type: node.type, status: "completed", enteredAt: now, resolvedAt: now });

    if (node.type === "end") {
      return { status: "completed" };
    }

    const edge = nextEdge(graph, node.id);
    if (!edge) {
      // Dead end that isn't an `end` node: treat as complete rather than failed, since the
      // process design (not the run) is responsible for terminating cleanly.
      return { status: "completed" };
    }
    currentId = edge.target;
  }
  return { status: "completed" };
}

/** Builds the initial run record for a freshly signed-off process graph. */
export function buildNewRun(
  processId: string,
  graph: ProcessGraphArtifactV11,
  baselineVersion: string,
  note: string | undefined,
): WorkflowRunRecordV1 {
  const steps: WorkflowStepRecordV1[] = [];
  const start = findStartNode(graph);
  const outcome = runForward(graph, start.id, steps);
  const now = new Date().toISOString();
  return {
    runId: crypto.randomUUID(),
    processId,
    baselineVersion,
    status: outcome.status,
    startedAt: now,
    updatedAt: now,
    completedAt: outcome.status === "completed" ? now : undefined,
    startedByNote: note,
    steps,
    pendingNodeId: outcome.pendingNodeId,
  };
}

/**
 * Resolves a run's pending decision/approval node with the supplied input,
 * then continues auto-completion until the next input point or the end.
 */
export function advanceRun(
  run: WorkflowRunRecordV1,
  graph: ProcessGraphArtifactV11,
  input: { condition?: string; approvalDecision?: "approved" | "rejected"; note?: string },
): WorkflowRunRecordV1 {
  if (run.status !== "waitingForInput" || !run.pendingNodeId) {
    throw new Error(`Run ${run.runId} is not waiting for input (status: ${run.status}).`);
  }
  const pendingNode = findNode(graph, run.pendingNodeId);
  const steps = [...run.steps];
  const pendingStepIndex = steps.findIndex((step) => step.nodeId === run.pendingNodeId && step.resolvedAt === undefined);
  if (pendingStepIndex === -1) {
    throw new Error(`Pending step for node ${run.pendingNodeId} not found in run ${run.runId}.`);
  }
  const now = new Date().toISOString();

  if (pendingNode.type === "approval") {
    if (input.approvalDecision !== "approved" && input.approvalDecision !== "rejected") {
      throw new Error(`Node ${pendingNode.id} is an approval node and requires approvalDecision "approved" or "rejected".`);
    }
    if (input.approvalDecision === "rejected") {
      steps[pendingStepIndex] = {
        ...steps[pendingStepIndex],
        status: "failed",
        resolvedAt: now,
        approvalDecision: "rejected",
        note: input.note,
      };
      return { ...run, status: "failed", updatedAt: now, completedAt: now, steps, pendingNodeId: undefined };
    }
    steps[pendingStepIndex] = {
      ...steps[pendingStepIndex],
      status: "completed",
      resolvedAt: now,
      approvalDecision: "approved",
      note: input.note,
    };
  } else if (pendingNode.type === "decision") {
    steps[pendingStepIndex] = {
      ...steps[pendingStepIndex],
      status: "completed",
      resolvedAt: now,
      chosenCondition: input.condition,
      note: input.note,
    };
  } else {
    throw new Error(`Node ${pendingNode.id} (${pendingNode.type}) does not accept input.`);
  }

  const edge = nextEdge(graph, pendingNode.id, input.condition);
  if (!edge) {
    return { ...run, status: "completed", updatedAt: now, completedAt: now, steps, pendingNodeId: undefined };
  }
  const outcome = runForward(graph, edge.target, steps);
  return {
    ...run,
    status: outcome.status,
    updatedAt: now,
    completedAt: outcome.status === "completed" ? now : undefined,
    steps,
    pendingNodeId: outcome.pendingNodeId,
  };
}
