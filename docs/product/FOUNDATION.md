# Product Foundation — v0.1

## Product thesis

Build an enterprise AI operating layer on top of Cloudflare OS that lets employees ask for outcomes, dynamically creates useful interfaces, safely accesses approved company systems, and executes governed workflows.

The product is not a reskin of Cloudflare OS. Cloudflare OS is the agent and gadget runtime. Our proprietary value sits above and around it: organisation context, integrations, permissions, workflow orchestration, approvals, auditability, model routing, and reusable business capabilities.

## v0.1 outcome

A signed-in employee can ask a business question, receive a useful generated interface, retrieve information through explicitly approved capabilities, and request an action that is governed by policy and recorded for audit.

Example journey:

1. User asks: "Show me supplier invoices over £20k awaiting approval."
2. The agent retrieves permitted invoice data and presents it in a generated gadget.
3. User asks: "Why are these stuck?"
4. The agent combines permitted workflow and business-system context.
5. User asks to progress eligible invoices.
6. Policy determines whether the action may execute immediately, requires approval, or must be denied.
7. The platform records the request, decision, execution result, actor, tenant and relevant capability.

## Architecture boundaries

### Upstream Cloudflare OS

Keep upstream pinned and replace it only when a product requirement cannot be implemented cleanly through supported boundaries.

Responsibilities:
- agent runtime
- Workshop
- gadget generation/runtime
- blueprints
- upstream Gatekeeper contracts
- sandbox/runtime primitives

### Product layer — this repository

Responsibilities:
- deployment and environment configuration
- product-owned Gatekeepers and enterprise capabilities
- organisation/tenant context
- identity mapping
- authorisation and policy
- approval orchestration
- workflow execution
- audit events
- model/provider policy
- observability
- product documentation and upgrade policy

### Core fork — b-als/cloudflare-os

Treat as an escape hatch, not the default development surface. Use only for product behaviour that genuinely requires changing upstream Cloudflare OS internals.

## Product primitives

### Tenant
A company/customer boundary. Every product-owned request, capability invocation and audit event must be attributable to a tenant.

### Actor
The authenticated person or service making a request. Identity must come from verified authentication context, never model-generated data.

### Capability
A narrowly scoped operation exposed to the agent, for example `invoices.list_pending` or `purchase_orders.read`. Capabilities should be explicit and typed rather than exposing broad unrestricted APIs.

### Policy decision
A deterministic decision made outside the model: `allow`, `require_approval`, or `deny`.

### Approval
A human authorisation required before a sensitive capability can execute.

### Workflow
A durable multi-step business process that may combine capabilities, approvals and system updates.

### Audit event
An append-oriented record describing who requested what, which tenant it affected, what policy decided, what capability executed and the outcome.

## Trust principles

1. The model proposes; deterministic controls authorise.
2. Tenant context is derived from trusted identity/configuration, not user prompts.
3. Capabilities are least-privilege and purpose-specific.
4. Read and write capabilities are distinguishable.
5. High-impact writes can require explicit approval.
6. Secrets never enter prompts, generated gadgets, tracked configuration or audit payloads.
7. Cross-tenant access is denied by construction.
8. Every externally consequential action is attributable and auditable.
9. Generated gadgets do not receive ambient authority to enterprise systems.
10. Upstream upgrades are deliberate and reviewed against the trust boundary.

## Initial module plan

Product-owned modules should evolve around these boundaries rather than modifying the upstream submodule:

- `packages/custom-gatekeeper` — first integration boundary and capability prototype
- `packages/product-core` — framework-agnostic tenant, actor, capability, policy and audit contracts
- future integration packages — adapters for specific enterprise systems
- future workflow package/worker — durable execution and approvals

Do not create integrations until a concrete customer workflow justifies them.

## v0.1 vertical slice

The first slice should use a synthetic invoice domain so we can prove the architecture without prematurely binding the product to SAP, Dynamics, ServiceNow or another vendor.

Required capabilities:
- list pending invoices
- inspect one invoice
- explain approval state using deterministic data
- request approval progression

The final operation must exercise the policy boundary and audit trail even if the underlying data source is initially synthetic.

## Not in v0.1

- billing
- broad connector marketplace
- arbitrary autonomous writes
- full multi-tenant SaaS control plane
- custom upstream Cloudflare OS runtime changes
- vendor-specific ERP integration before the vertical slice works

## Definition of done

v0.1 foundation is successful when the repository has a clear product/upstream boundary and the next implementation can add tenant-aware capabilities, policy decisions and audit events without editing the Cloudflare OS submodule.