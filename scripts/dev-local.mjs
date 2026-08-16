#!/usr/bin/env node

// dev-local.mjs - Wrapper around the `cloudflare-os` submodule's local dev launcher
// (`pnpm dev:local`) that also wires this repo's deployment-owned Gatekeepers
// (packages/custom-gatekeeper) into the local Wrangler dev session as GATEKEEPER_CUSTOM,
// matching what `scripts/deploy.mjs` binds in production. Without this, the submodule's
// gatekeeper auto-discovery only scans its own `packages/gatekeeper-*` folders and never
// sees Gatekeepers owned by this wrapper repo, so BA Studio / Workflow Studio would 404 or
// show "No such service: custom" when run via a plain `pnpm dev:local` in the submodule.
//
// Usage: pnpm dev:local   (from the repo root)

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SUBMODULE_DIR = join(ROOT, "cloudflare-os");
const isWin = process.platform === "win32";

// The derived binding name must be GATEKEEPER_CUSTOM to match scripts/deploy.mjs, so we tell
// run-dev-server.js (invoked inside the submodule) to treat this folder as "gatekeeper-custom".
const CUSTOM_GATEKEEPER_DIR = join(ROOT, "packages", "custom-gatekeeper");
const extraDirs = [`gatekeeper-custom=${CUSTOM_GATEKEEPER_DIR}`];

const existingExtra = process.env.EXTRA_GATEKEEPER_DIRS;
const env = {
  ...process.env,
  EXTRA_GATEKEEPER_DIRS: existingExtra ? `${existingExtra},${extraDirs.join(",")}` : extraDirs.join(","),
};

const args = ["run", "dev:local"];
let cmd, spawnArgs;
if (isWin) {
  cmd = process.env.ComSpec || "cmd.exe";
  spawnArgs = ["/c", "pnpm.cmd", ...args];
} else {
  cmd = "pnpm";
  spawnArgs = args;
}

const child = spawn(cmd, spawnArgs, {
  stdio: "inherit",
  cwd: SUBMODULE_DIR,
  env,
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
