# Copilot instructions for this repository

This repository uses a specialist-agent model. Do not execute multi-file customization work directly without routing to the correct specialist.

## Mandatory routing policy

1. Start with `.github/agents/customization-orchestrator.agent.md` for any non-trivial customization request.
2. Before any implementation, run the due-diligence gate in `.github/agents/due-diligence-specialist.agent.md`: search both `cloudflare-os-starter` and the `cloudflare-os` submodule for an existing mechanism (agent/tool loop, chat UI, Gatekeeper pattern, binding, script) before building something new. This applies to every lane and every change, however small it looks — see that file for the concrete incident that made this mandatory.
3. Route implementation to exactly one file owner lane at a time.
4. If a request spans multiple owners, sequence handoffs through the orchestrator.
5. Never parallel-edit the same file across multiple agents.

## Specialist ownership map

- Deploy config: `.github/agents/deploy-config-specialist.agent.md` owns `deployment.jsonc`.
- Deploy pipeline: `.github/agents/deploy-pipeline-specialist.agent.md` owns `scripts/deploy.mjs` and `scripts/deploy.test.mjs`.
- Custom Gatekeeper: `.github/agents/custom-gatekeeper-specialist.agent.md` owns `packages/custom-gatekeeper/**`.
- Error Reporter: `.github/agents/error-reporter-specialist.agent.md` owns `packages/error-reporter/**`.
- Workflow Studio frontend: `.github/agents/workflow-studio-specialist.agent.md` owns `cloudflare-os/packages/workshop-frontend/**` for workflow graph UX.
- Docs and policy: `.github/agents/docs-policy-specialist.agent.md` owns `README.md`, `docs/**`, `AGENTS.md`, and `.github/agents/**`.
- QA and release: `.github/agents/qa-release-specialist.agent.md` owns cross-lane validation, release checks, and rollback notes.
- Deployment execution: `.github/agents/deploy-cloudflare-os.agent.md` owns deploy/redeploy operations.
- Due diligence gate: `.github/agents/due-diligence-specialist.agent.md` owns no files; it is a mandatory pre-implementation check run by every other lane.

## Repository safety constraints

- Never open, update, or merge a public pull request unless the user explicitly requests that action.
- Default to local changes or the user fork (`origin`), never `upstream`.
- Keep `main` as an upstream mirror; do customization work on `custom` or feature branches from `custom`.
