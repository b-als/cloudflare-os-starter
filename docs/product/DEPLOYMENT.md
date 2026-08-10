# Deployment plan

Deployment is part of the v0.2 acceptance test, not a separate future project.

## Gate 1 — repository validation

Before deploying a product branch:

1. install the starter and pinned Cloudflare OS dependencies;
2. run `pnpm check`;
3. run the custom Gatekeeper tests;
4. confirm no unintended upstream/submodule changes;
5. inspect the generated Wrangler configuration.

## Gate 2 — Cloudflare evaluation deployment

Use the starter deployment path with a `workers.dev` route first. This gives us a disposable environment for validating the full Workshop + Gatekeeper interaction before attaching a production hostname.

Required operator configuration in `deployment.jsonc`:

- Cloudflare account ID;
- unique Worker names for Workshop, Context, Finance Gatekeeper and Error Reporter;
- authentication configuration and administrator email;
- `workersDev: true` for the evaluation route;
- optional AI Gateway configuration if platform-funded models are required.

KV and R2 resources can remain on automatic provisioning for the first evaluation deployment.

## Gate 3 — v0.2 acceptance flow

The deployed system passes when a signed-in user can ask the agent to:

1. show invoices awaiting attention;
2. explain why `INV-1048` cannot progress;
3. request approval for `INV-1042`;
4. see that the request enters the governed approval path rather than changing state immediately;
5. approve/apply the action;
6. confirm `INV-1042` no longer appears as pending;
7. inspect Worker logs for the interaction.

## Gate 4 — product environment

Only after the acceptance flow works do we attach a product domain, tighten Access policies, define release identifiers, reduce production sampling, and begin replacing synthetic adapters with real enterprise connectors.

The first Cloudflare deployment should therefore happen immediately after the v0.2 branch passes local/type validation.
