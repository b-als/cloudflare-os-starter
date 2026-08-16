/**
 * BA Studio — registry of all BA projects on this deployment.
 *
 * `BaProjectDurableObject` deliberately has no way to enumerate other
 * projects (each project is its own Durable Object keyed by `processId`, so
 * there is nothing to list from). This singleton mirrors the "domain
 * registry" pattern already used by the Context Library gatekeeper
 * (`packages/gatekeeper-context/src/registry-do.ts`'s
 * `LibraryRegistryDurableObject`): one small Durable Object that indexes
 * lightweight summaries so a "BA Projects" management page can list/create
 * projects without scanning every per-project Durable Object.
 *
 * This registry is deliberately eventually-consistent and best-effort: it is
 * an index for discovery/UX, not the source of truth for a project's
 * content (that remains `BaProjectDurableObject`). A registry write failure
 * should never block a project save.
 */
import { DurableObject } from "cloudflare:workers";
import type { BaProjectSummary } from "./types.js";

const REGISTRY_KEY = "projects";

export class BaProjectRegistryDurableObject extends DurableObject<Cloudflare.Env> {
  /** Lists all registered BA projects, most recently updated first. */
  async list(): Promise<BaProjectSummary[]> {
    const projects = (await this.ctx.storage.get<Record<string, BaProjectSummary>>(REGISTRY_KEY)) ?? {};
    return Object.values(projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Creates or updates a project's registry entry, preserving its original `createdAt`. */
  async upsert(summary: BaProjectSummary): Promise<void> {
    const projects = (await this.ctx.storage.get<Record<string, BaProjectSummary>>(REGISTRY_KEY)) ?? {};
    const existing = projects[summary.processId];
    projects[summary.processId] = existing ? { ...summary, createdAt: existing.createdAt } : summary;
    await this.ctx.storage.put(REGISTRY_KEY, projects);
  }
}

const MAX_SLUG_LENGTH = 200;

/**
 * Derives a URL/DO-name-safe `processId` from a human-entered project name,
 * plus a short random suffix so two projects created with the same name
 * (e.g. "Untitled process") never collide.
 */
export function generateProcessId(processName: string): string {
  const slug = processName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
  const suffix = crypto.randomUUID().slice(0, 8);
  return slug.length > 0 ? `proc-${slug}-${suffix}` : `proc-${suffix}`;
}
