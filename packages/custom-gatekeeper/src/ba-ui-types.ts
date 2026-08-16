/**
 * Type-only contract for the BA Studio app UI capability, shared between the
 * Worker implementation (`ba-ui-api.ts`) and the sandboxed iframe app
 * (`app/main.tsx`, `app/App.tsx`). Kept free of `cloudflare:workers` imports
 * so the Vite/app tsconfig (which targets the DOM, not the Workers runtime)
 * can resolve it directly.
 */

import type {
  BaProjectRecord,
  BaProjectSummary,
  StakeholderSuggestionV11,
  WorkflowRunRecordV1,
  WorkflowStudioDemoV11,
} from "./types.js";

/** RPC capability handed to the BA Studio sandboxed iframe via `startAppUi()`. */
export interface BaUiApi {
  /** Whether the current user is an admin (surfaced for future write-gating in the UI). */
  isAdmin(): Promise<boolean>;

  /** Returns the stored artifact bundle for a project, or null if none has been saved yet. */
  getProject(processId: string): Promise<BaProjectRecord | null>;

  /** Validates and persists a new artifact bundle version for a project. */
  saveProject(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord>;

  /** Returns a fresh, valid starter bundle for a brand-new project. */
  createStarterBundle(processId: string, processName: string): Promise<WorkflowStudioDemoV11>;

  /**
   * Lists summaries of every BA Studio project created on this deployment,
   * most recently updated first. Backs the BA Projects management page.
   */
  listProjects(): Promise<BaProjectSummary[]>;

  /**
   * Creates a new BA Studio project with a starter artifact bundle,
   * generating a unique `processId` from `processName`.
   */
  createProject(processName: string): Promise<BaProjectRecord>;

  /**
   * Returns advisory stakeholder suggestions for a bundle: names/roles
   * mentioned during interviews plus any role-coverage gaps found by
   * cross-referencing requirement categories against registered
   * stakeholder roles. Purely advisory -- a human decides whether to act.
   */
  getStakeholderSuggestions(bundle: WorkflowStudioDemoV11): Promise<StakeholderSuggestionV11[]>;

  /**
   * Starts a new workflow run from the project's signed-off process graph.
   * Throws if the project has no saved bundle, or its sign-off packet has
   * no approved decision.
   */
  startWorkflowRun(processId: string, note?: string): Promise<WorkflowRunRecordV1>;

  /** Resolves a `waitingForInput` run's pending decision/approval node and continues it. */
  advanceWorkflowRun(
    processId: string,
    runId: string,
    input: { condition?: string; approvalDecision?: "approved" | "rejected"; note?: string },
  ): Promise<WorkflowRunRecordV1>;

  /** Returns a single workflow run, or null if it does not exist. */
  getWorkflowRun(processId: string, runId: string): Promise<WorkflowRunRecordV1 | null>;

  /** Lists all workflow runs recorded for a project, most recent first. */
  listWorkflowRuns(processId: string): Promise<WorkflowRunRecordV1[]>;
}
