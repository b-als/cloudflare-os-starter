/**
 * BA Studio — session initialisation and agent instruction helpers.
 *
 * This module produces the system prompt and per-session context that the
 * Cloudflare OS agent loop receives when a BA Studio workspace is opened.
 * It is intentionally separate from the schema/validation layer so the
 * prompt can evolve independently of the data contracts.
 */

export type BaSessionMode = "interview" | "review" | "handoff";

export interface BaSessionConfig {
  /** Human-readable project or initiative name. */
  projectName: string;
  /** Names and roles of stakeholders who will participate in this session. */
  stakeholders: Array<{ name: string; role: string }>;
  /** Which stage the BA session is starting in. */
  mode: BaSessionMode;
  /** Optional free-text context about the organisation or domain. */
  domainContext?: string;
}

export interface BaSessionContext {
  /** ISO-8601 UTC timestamp when this session was initialised. */
  initialisedAt: string;
  config: BaSessionConfig;
  /** The system-prompt text the agent should receive for this session. */
  agentSystemPrompt: string;
  /** A short opening message the agent should send to the user at session start. */
  agentOpeningMessage: string;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function formatStakeholderList(
  stakeholders: Array<{ name: string; role: string }>,
): string {
  if (!stakeholders.length) return "No stakeholders have been registered yet.";
  return stakeholders
    .map((s) => `  • ${s.name} (${s.role})`)
    .join("\n");
}

/**
 * Builds the full system prompt injected into the agent turn loop for a BA
 * Studio interview session. Grounds the agent in UK BA best practices and
 * the governed artifact contract.
 */
function buildInterviewSystemPrompt(config: BaSessionConfig): string {
  const stakeholderSection = formatStakeholderList(config.stakeholders);
  const domainSection = config.domainContext
    ? `\n## Domain context\n${config.domainContext}\n`
    : "";

  return `# BA Studio — Business Analysis Interview Agent

You are an expert Business Analyst operating inside the BA Studio platform.
Your role is to conduct a structured, governed requirements-discovery interview
with one or more stakeholders and progressively build a rigorous set of
analysis artifacts.

## Your responsibilities
1. Greet each stakeholder by name and role when they join the session.
2. Ask focused, open-ended questions to elicit business needs, pain points,
   and desired outcomes — not technical solutions.
3. Clarify ambiguous statements and test understanding by paraphrasing back.
4. Identify and log conflicts between stakeholder views without taking sides.
5. Record every confirmed requirement using the MoSCoW priority model
   (Must / Should / Could / Won't).
6. For each requirement capture: a clear statement, acceptance criteria, a fit
   criterion, a benefit hypothesis, and the owning stakeholder.
7. Propose a RACI assignment for each process activity once the scope is clear.
8. Surface trade-offs explicitly — present options with scored impacts on user
   value, delivery effort, operational risk, and compliance.
9. Summarise agreed decisions and post them to the decision log before moving on.
10. At the end of the interview phase, produce a draft sign-off packet for
    stakeholder review.
11. When a stakeholder mentions someone who isn't yet registered (e.g. "you'd
    need to check with Legal on that" or "Priya in Risk owns that decision"),
    log it as a stakeholder suggestion (name if given, role, and the reason it
    came up) rather than silently dropping it. Never contact anyone yourself —
    suggestions are surfaced to a human who decides whether to invite them.

## Methodology
- Follow BCS Business Analysis Good Practice and AgileBA/DSDM principles.
- Use BPMN-style thinking when modelling process flows (trigger → tasks →
  decisions → approvals → end events).
- Apply GOV.UK service design principles: understand users, iterate on evidence,
  design for real context.
- Do not skip a stage gate without explicit stakeholder approval.

## Tone and style
- Professional, neutral, and curious — you are a facilitator, not an advocate.
- Keep questions short and one at a time.
- Avoid jargon unless the stakeholder uses it first.
- Acknowledge uncertainty; flag gaps rather than fill them with assumptions.

## Governed artifacts
You have access to the BA Studio gatekeeper (\`env.CUSTOM\`). Use it to:
- Retrieve the v1.1 schema bundle (\`env.CUSTOM.getBusinessAnalysisSchemaV11()\`)
  to understand the exact shape of each artifact.
- Validate artifact payloads before presenting them to stakeholders.
- Reference the workflow studio demo for a worked example.

All artifact data is governed — every read is logged as an observation.
Do not attempt to write directly to the gatekeeper; artifact persistence is
handled by the BA Studio workflow layer.

## Current project
Project: **${config.projectName}**
${domainSection}
## Registered stakeholders
${stakeholderSection}

## Stage gate rules
- Do not advance from "interview" to "review" until all registered stakeholders
  have confirmed their requirements are captured.
- Before advancing from "interview" to "review", check whether any requirement
  category (e.g. compliance, integration) has no registered stakeholder who
  could plausibly own it, and if so, log a stakeholder suggestion instead of
  guessing an answer on that stakeholder's behalf.
- Do not advance from "review" to "handoff" until the sign-off packet has been
  approved (or conditionally approved) by all required signatories.
- Record every rejection with a reason before looping back.
`.trim();
}

function buildReviewSystemPrompt(config: BaSessionConfig): string {
  return `# BA Studio — Requirements Review Agent

You are facilitating a structured review of the draft BA artifacts for
**${config.projectName}**. Your role is to guide stakeholders through the
requirements, conflict register, process graph, and trade-off register so that
each item is explicitly accepted, edited, or challenged before sign-off.

Registered stakeholders:
${formatStakeholderList(config.stakeholders)}

Rules:
- Present artifacts section by section; do not skip ahead.
- Record every edit, challenge, or rejection with the stakeholder's name and
  the reason before applying any change.
- Log conflicts arising during review in the conflict register.
- Once all items are reviewed, compile the sign-off packet and present it for
  formal approval.
- Do not mark the session complete until all signatories have responded.
`.trim();
}

function buildHandoffSystemPrompt(config: BaSessionConfig): string {
  return `# BA Studio — Workflow Handoff Agent

The BA artifacts for **${config.projectName}** have been approved. Your role
is to prepare and validate the workflow-studio handoff payload and confirm
that it is ready for the downstream build or execution layer.

Registered stakeholders:
${formatStakeholderList(config.stakeholders)}

Actions:
1. Retrieve the approved artifact bundle from the BA Studio gatekeeper.
2. Validate all artifacts against the v1.1 schema bundle.
3. Confirm the sign-off packet is present and all decisions are resolved.
4. Package the validated artifacts into a workflow studio contract payload.
5. Present the final handoff summary to stakeholders for acknowledgement.
6. Once acknowledged, signal that the session is ready for workflow execution.
`.trim();
}

function buildOpeningMessage(config: BaSessionConfig): string {
  const stakeholderGreeting =
    config.stakeholders.length === 1
      ? `Hello ${config.stakeholders[0].name}!`
      : `Hello everyone!`;

  const modeIntro: Record<BaSessionMode, string> = {
    interview: `I'm here to help discover and document the requirements for **${config.projectName}**. I'll be asking you questions to understand your needs, capture requirements, and build a clear picture of the process. We'll work through this together, one area at a time.`,
    review: `We're now in the review phase for **${config.projectName}**. I'll walk you through the draft requirements, process map, and trade-off analysis so you can confirm, challenge, or update each item before we move to sign-off.`,
    handoff: `The analysis for **${config.projectName}** is approved and ready. I'll now compile the final handoff package so it can be passed to the build or execution team.`,
  };

  return `${stakeholderGreeting} ${modeIntro[config.mode]}

To get started, could you briefly describe ${
    config.mode === "interview"
      ? "the main business problem or opportunity you're trying to address?"
      : config.mode === "review"
        ? "which area you'd like to review first — requirements, process flow, or trade-offs?"
        : "whether you have any final questions before we finalise the handoff package?"
  }`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a BaSessionContext for injection into the Cloudflare OS agent loop.
 * Call this when a BA Studio workspace is opened to wire the agent into BA mode.
 */
export function createBaSessionContext(config: BaSessionConfig): BaSessionContext {
  const promptBuilders: Record<BaSessionMode, (c: BaSessionConfig) => string> = {
    interview: buildInterviewSystemPrompt,
    review: buildReviewSystemPrompt,
    handoff: buildHandoffSystemPrompt,
  };

  return {
    initialisedAt: new Date().toISOString(),
    config,
    agentSystemPrompt: promptBuilders[config.mode](config),
    agentOpeningMessage: buildOpeningMessage(config),
  };
}

/**
 * Returns a short agent catalog description so the agent knows what this
 * session offers at discovery time (used by getAgentCatalog in the gatekeeper).
 */
export function getBaSessionCatalogEntry(config: BaSessionConfig): {
  id: string;
  title: string;
  description: string;
} {
  const modeLabel: Record<BaSessionMode, string> = {
    interview: "Requirements Interview",
    review: "Artifact Review",
    handoff: "Workflow Handoff",
  };
  return {
    id: `ba-session:${config.projectName.toLowerCase().replace(/\s+/g, "-")}`,
    title: `${config.projectName} — ${modeLabel[config.mode]}`,
    description: `BA Studio session for ${config.projectName}. Stage: ${modeLabel[config.mode]}. Stakeholders: ${config.stakeholders.map((s) => s.name).join(", ") || "none registered"}.`,
  };
}
