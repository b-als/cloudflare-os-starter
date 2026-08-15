# @product/core

Framework-agnostic contracts for the product trust boundary.

This package intentionally contains no Cloudflare Worker, model-provider, ERP or UI implementation. It defines the concepts that product-owned integrations must obey: tenant context, authenticated actors, explicit capabilities, deterministic policy decisions and audit events.

## Rule

An LLM may select or propose a capability invocation, but it does not decide whether a protected action is authorised. Product-owned code must derive trusted tenant/actor context, evaluate policy and record consequential actions outside the model.

The first implementation target is the synthetic invoice vertical slice described in `docs/product/FOUNDATION.md`.
