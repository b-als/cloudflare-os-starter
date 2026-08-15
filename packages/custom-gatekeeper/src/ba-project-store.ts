/**
 * BA Studio — durable, versioned per-project artifact storage.
 *
 * Each BA Studio project (one `processId`) gets its own Durable Object
 * instance, following the same "one DO per unit of collaboration" pattern
 * used by the Context Library gatekeeper (see
 * packages/gatekeeper-context/src/context-collection.ts). This keeps BA
 * projects isolated from one another and lets Cloudflare shard load across
 * projects automatically, rather than serializing every project's reads and
 * writes through a single shared record.
 *
 * This is intentionally the storage seam only: it holds and versions the
 * validated artifact bundle. Governance (who may write, and whether a write
 * requires approval) is the caller's responsibility -- see
 * `CustomSessionImpl.saveBaProject()` in custom.ts.
 */

import { DurableObject } from "cloudflare:workers";
import { validateWorkflowStudioDemoV11 } from "./workflow-demo.js";
import type { WorkflowStudioDemoV11 } from "./types.js";

const RECORD_KEY = "record";

/** A stored BA Studio project bundle with its monotonic version and last-write time. */
export interface BaProjectRecord {
  processId: string;
  version: number;
  updatedAt: string;
  bundle: WorkflowStudioDemoV11;
}

/**
 * Validates a candidate bundle against the target project id and the v1.1
 * artifact schema, then builds the next versioned record for it. Pulled out
 * as a pure function (no Durable Object storage access) so it can be unit
 * tested directly, without needing a real Workers runtime to construct a
 * `BaProjectDurableObject` instance.
 */
export function buildNextRecord(
  processId: string,
  bundle: WorkflowStudioDemoV11,
  previous: BaProjectRecord | null,
): BaProjectRecord {
  if (bundle.processGraph.processId !== processId) {
    throw new Error(
      `Bundle processGraph.processId (${bundle.processGraph.processId}) does not match project ${processId}.`,
    );
  }
  const errors = validateWorkflowStudioDemoV11(bundle);
  if (errors.length) {
    throw new Error(`BA Studio bundle is invalid: ${errors.join(" | ")}`);
  }
  return {
    processId,
    version: (previous?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    bundle,
  };
}

export class BaProjectDurableObject extends DurableObject<Cloudflare.Env> {
  /** Returns the current bundle for this project, or null if none has been saved yet. */
  async getRecord(): Promise<BaProjectRecord | null> {
    const record = await this.ctx.storage.get<BaProjectRecord>(RECORD_KEY);
    return record ?? null;
  }

  /**
   * Validates and persists a new bundle version for this project. Rejects a
   * bundle whose `processGraph.processId` does not match this project's id,
   * and rejects a bundle that fails the v1.1 artifact schema validation.
   */
  async saveBundle(processId: string, bundle: WorkflowStudioDemoV11): Promise<BaProjectRecord> {
    const previous = await this.ctx.storage.get<BaProjectRecord>(RECORD_KEY);
    const record = buildNextRecord(processId, bundle, previous ?? null);
    await this.ctx.storage.put(RECORD_KEY, record);
    return record;
  }
}
