/**
 * Type-only contract for the BA Studio app UI capability, shared between the
 * Worker implementation (`ba-ui-api.ts`) and the sandboxed iframe app
 * (`app/main.tsx`, `app/App.tsx`). Kept free of `cloudflare:workers` imports
 * so the Vite/app tsconfig (which targets the DOM, not the Workers runtime)
 * can resolve it directly.
 */

import type { BaProjectRecord, StakeholderSuggestionV11, WorkflowStudioDemoV11 } from "./types.js";

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
   * Returns advisory stakeholder suggestions for a bundle: names/roles
   * mentioned during interviews plus any role-coverage gaps found by
   * cross-referencing requirement categories against registered
   * stakeholder roles. Purely advisory -- a human decides whether to act.
   */
  getStakeholderSuggestions(bundle: WorkflowStudioDemoV11): Promise<StakeholderSuggestionV11[]>;
}
