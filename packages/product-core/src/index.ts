export type TenantId = string;
export type ActorId = string;

export interface TenantContext {
  tenantId: TenantId;
  slug: string;
}

export interface ActorContext {
  actorId: ActorId;
  email?: string;
  roles: readonly string[];
}

export type CapabilityEffect = "read" | "write";

export interface CapabilityDescriptor {
  id: string;
  description: string;
  effect: CapabilityEffect;
  requiresTenant: true;
}

export interface CapabilityRequest<TInput = unknown> {
  requestId: string;
  tenant: TenantContext;
  actor: ActorContext;
  capability: CapabilityDescriptor;
  input: TInput;
  requestedAt: string;
}

export type PolicyDecision =
  | { outcome: "allow"; reason: string }
  | { outcome: "require_approval"; reason: string; approvalType: string }
  | { outcome: "deny"; reason: string };

export interface AuditEvent {
  eventId: string;
  requestId: string;
  tenantId: TenantId;
  actorId: ActorId;
  capabilityId: string;
  effect: CapabilityEffect;
  policyOutcome: PolicyDecision["outcome"];
  outcome: "requested" | "approved" | "denied" | "succeeded" | "failed";
  occurredAt: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PolicyEngine {
  evaluate(request: CapabilityRequest): Promise<PolicyDecision>;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export interface Capability<TInput = unknown, TOutput = unknown> {
  descriptor: CapabilityDescriptor;
  execute(request: CapabilityRequest<TInput>): Promise<TOutput>;
}
