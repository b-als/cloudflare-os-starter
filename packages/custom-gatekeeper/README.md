# Finance Operations Gatekeeper

This package is the first product-owned enterprise capability layered around the pinned Cloudflare OS runtime.

It intentionally uses synthetic finance data so the trust boundary can be validated before any real ERP, accounting, procurement, or workflow system is connected.

## v0.2 capability

The agent receives a `CustomSession` that can:

- list invoices requiring attention;
- inspect an individual invoice;
- explain deterministic workflow blocks;
- request approval progression through Cloudflare OS's approval queue.

Read operations call `authorizeObservation()` before returning business data. Side effects never execute directly from the model-facing RPC method. `requestInvoiceApproval()` persists a pending action and submits it to `ApprovalQueue.submitAction()`. State changes only when the Gatekeeper later receives `applyAction()` from the governed approval path.

Blocked invoices are rejected before submission according to deterministic synthetic finance policy. v0.2 deliberately exposes no auto-approvable actions.

## Synthetic scenarios

- `INV-1042`: £28,750, valid PO, awaiting Finance Director approval.
- `INV-1048`: £46,200, blocked because no PO is attached.
- `INV-1051`: £18,450, valid PO, awaiting Head of Finance approval.
- `INV-1057`: £73,500, blocked because it exceeds delegated authority and requires CFO approval.

## Next step

Replace the synthetic repository with an adapter to a real customer system while retaining the same governed session and approval boundary. Do not put vendor credentials or direct unrestricted write APIs in the agent-facing surface.
