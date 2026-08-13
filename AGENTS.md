This repository is a deployment wrapper around a pinned `cloudflare/cloudflare-os` release (see README.md): it adds branding, identity, routing, and integration customizations without patching the upstream source, and pins that source via the `cloudflare-os` git submodule.

## Copilot instruction source of truth

- `.github/copilot-instructions.md` defines the mandatory specialist-agent routing policy for this repository.
- Any Copilot coding workflow must follow that routing policy before implementation.

## PR and publishing policy

- Never open, update, or merge a public pull request for this repository or its submodule unless the user explicitly asks for that action.
- Keep all custom work on the private local checkout or the user's fork by default.
- If a PR is required, prefer a private branch or fork workflow and confirm the destination repo before taking any publishing action.

## Parallel agent topology (conflict-safe)

- Orchestrator: `.github/agents/customization-orchestrator.agent.md`
- Deploy config owner: `.github/agents/deploy-config-specialist.agent.md` (`deployment.jsonc`)
- Deploy pipeline owner: `.github/agents/deploy-pipeline-specialist.agent.md` (`scripts/deploy.mjs`, `scripts/deploy.test.mjs`)
- Custom Gatekeeper owner: `.github/agents/custom-gatekeeper-specialist.agent.md` (`packages/custom-gatekeeper/**`)
- Error Reporter owner: `.github/agents/error-reporter-specialist.agent.md` (`packages/error-reporter/**`)
- Workflow Studio frontend owner: `.github/agents/workflow-studio-specialist.agent.md` (`cloudflare-os/packages/workshop-frontend/**`)
- Docs/policy owner: `.github/agents/docs-policy-specialist.agent.md` (`README.md`, `docs/**`, `AGENTS.md`, `.github/agents/**`)
- QA/release owner: `.github/agents/qa-release-specialist.agent.md` (validation and release sign-off)

Rule: one file owner per sprint. If two lanes need the same file, sequence them instead of parallelizing.

## Fork / upstream workflow (this checkout)

This local checkout is a fork of `cloudflare/cloudflare-os-starter`, set up to track upstream while keeping custom changes separate:

- `origin` remote → `b-als/cloudflare-os-starter` (this fork; push custom work here).
- `upstream` remote → `cloudflare/cloudflare-os-starter` (read-only; never push here).
- `main` branch → kept pristine, always mirrors `upstream/main`. Do not commit custom changes on `main`.
- `custom` branch → where all custom changes live and get committed/pushed. Work here by default.

The nested `cloudflare-os` submodule follows the same fork/upstream remote convention (`origin` = `b-als/cloudflare-os`, `upstream` = `cloudflare/cloudflare-os`); it stays pinned to a specific commit rather than a branch, per normal submodule usage.

To pull in upstream updates without losing customizations:
```
git fetch upstream
git checkout main && git reset --hard upstream/main
git checkout custom && git merge main   # resolve conflicts here
git push origin custom
```
