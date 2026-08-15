/**
 * BA Studio — durable workflow run storage.
 *
 * One Durable Object per BA Studio project (same "one DO per unit of
 * collaboration" pattern as `BaProjectDurableObject`), holding every
 * workflow run ever started for that project, keyed by `runId`. Kept
 * separate from `BaProjectDurableObject` so heavy run history never
 * contends with reads/writes of the live artifact bundle.
 */

import { DurableObject } from "cloudflare:workers";
import type { WorkflowRunRecordV1 } from "./types.js";

const RUNS_KEY = "runs";
const MAX_RUNS_PER_PROJECT = 1000;

export class WorkflowRunDurableObject extends DurableObject<Cloudflare.Env> {
  async #loadAll(): Promise<WorkflowRunRecordV1[]> {
    return (await this.ctx.storage.get<WorkflowRunRecordV1[]>(RUNS_KEY)) ?? [];
  }

  async getRun(runId: string): Promise<WorkflowRunRecordV1 | null> {
    const runs = await this.#loadAll();
    return runs.find((run) => run.runId === runId) ?? null;
  }

  /** Returns all runs for this project, most recently started first. */
  async listRuns(): Promise<WorkflowRunRecordV1[]> {
    const runs = await this.#loadAll();
    return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async putRun(run: WorkflowRunRecordV1): Promise<WorkflowRunRecordV1> {
    const runs = await this.#loadAll();
    const index = runs.findIndex((existing) => existing.runId === run.runId);
    if (index === -1) {
      runs.push(run);
      if (runs.length > MAX_RUNS_PER_PROJECT) {
        // Drop the oldest runs so a long-lived project's history can't grow storage
        // unboundedly; recent runs (what anyone would actually want to inspect) are kept.
        runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        runs.splice(0, runs.length - MAX_RUNS_PER_PROJECT);
      }
    } else {
      runs[index] = run;
    }
    await this.ctx.storage.put(RUNS_KEY, runs);
    return run;
  }
}
