import type {
  BusinessAnalysisSchemaBundleV1,
  BusinessAnalysisSchemaBundleV11,
  ConflictRegisterArtifactV1,
  ConflictRegisterArtifactV11,
  ProcessGraphArtifactV1,
  ProcessGraphArtifactV11,
  RequirementsArtifactV1,
  RequirementsArtifactV11,
  SignoffPacketArtifactV11,
  TradeoffRegisterArtifactV11,
} from "./types.js";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema" as const;

export const BUSINESS_ANALYSIS_SCHEMA_V1: BusinessAnalysisSchemaBundleV1 = {
  requirements: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/requirements/v1",
    title: "Requirements Artifact v1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "generatedAt", "stakeholders", "requirements"],
    properties: {
      schemaVersion: { const: "requirements/v1" },
      processId: { type: "string", minLength: 1 },
      generatedAt: { type: "string", format: "date-time" },
      stakeholders: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "role"],
          properties: {
            id: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            role: { type: "string", minLength: 1 },
          },
        },
      },
      requirements: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "category",
            "statement",
            "acceptanceCriteria",
            "priority",
            "ownerStakeholderId",
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            title: { type: "string", minLength: 1 },
            category: {
              enum: ["functional", "nonFunctional", "data", "integration", "compliance", "reporting"],
            },
            statement: { type: "string", minLength: 1 },
            acceptanceCriteria: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            priority: { enum: ["must", "should", "could", "wont"] },
            ownerStakeholderId: { type: "string", minLength: 1 },
            dependencies: {
              type: "array",
              items: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
  conflictRegister: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/conflicts/v1",
    title: "Conflict Register Artifact v1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "conflicts"],
    properties: {
      schemaVersion: { const: "conflicts/v1" },
      processId: { type: "string", minLength: 1 },
      conflicts: {
        type: "array",
        minItems: 0,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "summary",
            "requirementIds",
            "stakeholderIds",
            "impact",
            "decision",
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            requirementIds: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            stakeholderIds: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            impact: { enum: ["scope", "cost", "timeline", "risk", "compliance"] },
            decision: {
              type: "object",
              additionalProperties: false,
              required: ["status"],
              properties: {
                status: { enum: ["open", "inReview", "resolved", "deferred", "rejected"] },
              },
            },
          },
        },
      },
    },
  },
  processGraph: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/process-graph/v1",
    title: "Process Graph Artifact v1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "nodes", "edges"],
    properties: {
      schemaVersion: { const: "process-graph/v1" },
      processId: { type: "string", minLength: 1 },
      nodes: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "label"],
          properties: {
            id: { type: "string", minLength: 1 },
            type: { enum: ["trigger", "task", "decision", "integration", "approval", "end"] },
            label: { type: "string", minLength: 1 },
          },
        },
      },
      edges: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "source", "target"],
          properties: {
            id: { type: "string", minLength: 1 },
            source: { type: "string", minLength: 1 },
            target: { type: "string", minLength: 1 },
            condition: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

export const BUSINESS_ANALYSIS_SCHEMA_V11: BusinessAnalysisSchemaBundleV11 = {
  requirements: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/requirements/v1.1",
    title: "Requirements Artifact v1.1",
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "processId",
      "generatedAt",
      "stakeholders",
      "requirements",
      "raci",
      "decisionLog",
    ],
    properties: {
      schemaVersion: { const: "requirements/v1.1" },
      processId: { type: "string", minLength: 1 },
      generatedAt: { type: "string", format: "date-time" },
      stakeholders: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "role"],
          properties: {
            id: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            role: { type: "string", minLength: 1 },
          },
        },
      },
      requirements: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "category",
            "statement",
            "acceptanceCriteria",
            "priority",
            "ownerStakeholderId",
            "sourceStakeholderIds",
            "fitCriterion",
            "benefitHypothesis",
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            title: { type: "string", minLength: 1 },
            category: {
              enum: ["functional", "nonFunctional", "data", "integration", "compliance", "reporting"],
            },
            statement: { type: "string", minLength: 1 },
            acceptanceCriteria: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            priority: { enum: ["must", "should", "could", "wont"] },
            ownerStakeholderId: { type: "string", minLength: 1 },
            sourceStakeholderIds: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            fitCriterion: { type: "string", minLength: 1 },
            benefitHypothesis: { type: "string", minLength: 1 },
            dependencies: {
              type: "array",
              items: { type: "string", minLength: 1 },
            },
          },
        },
      },
      raci: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["activityId", "responsible", "accountable", "consulted", "informed"],
          properties: {
            activityId: { type: "string", minLength: 1 },
            responsible: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            accountable: { type: "string", minLength: 1 },
            consulted: { type: "array", items: { type: "string", minLength: 1 } },
            informed: { type: "array", items: { type: "string", minLength: 1 } },
          },
        },
      },
      decisionLog: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "summary", "rationale", "requirementIds", "ownerStakeholderId", "status"],
          properties: {
            id: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            rationale: { type: "string", minLength: 1 },
            requirementIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            ownerStakeholderId: { type: "string", minLength: 1 },
            status: { enum: ["proposed", "approved", "rejected", "superseded"] },
          },
        },
      },
    },
  },
  conflictRegister: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/conflicts/v1.1",
    title: "Conflict Register Artifact v1.1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "conflicts"],
    properties: {
      schemaVersion: { const: "conflicts/v1.1" },
      processId: { type: "string", minLength: 1 },
      conflicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "summary",
            "requirementIds",
            "stakeholderIds",
            "impact",
            "resolutionOwnerStakeholderId",
            "decision",
          ],
          properties: {
            id: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            requirementIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            stakeholderIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            impact: { enum: ["scope", "cost", "timeline", "risk", "compliance"] },
            resolutionOwnerStakeholderId: { type: "string", minLength: 1 },
            decision: {
              type: "object",
              additionalProperties: false,
              required: ["status"],
              properties: {
                status: { enum: ["open", "inReview", "resolved", "deferred", "rejected"] },
              },
            },
          },
        },
      },
    },
  },
  processGraph: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/process-graph/v1.1",
    title: "Process Graph Artifact v1.1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "nodes", "edges"],
    properties: {
      schemaVersion: { const: "process-graph/v1.1" },
      processId: { type: "string", minLength: 1 },
      nodes: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "label"],
          properties: {
            id: { type: "string", minLength: 1 },
            type: { enum: ["trigger", "task", "decision", "integration", "approval", "end"] },
            label: { type: "string", minLength: 1 },
            swimlaneStakeholderId: { type: "string", minLength: 1 },
            slaHours: { type: "number", exclusiveMinimum: 0 },
          },
        },
      },
      edges: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "source", "target"],
          properties: {
            id: { type: "string", minLength: 1 },
            source: { type: "string", minLength: 1 },
            target: { type: "string", minLength: 1 },
            condition: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  tradeoffRegister: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/tradeoffs/v1.1",
    title: "Trade-off Register Artifact v1.1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "options", "preferredOptionId"],
    properties: {
      schemaVersion: { const: "tradeoffs/v1.1" },
      processId: { type: "string", minLength: 1 },
      preferredOptionId: { type: "string", minLength: 1 },
      options: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "summary", "scores", "impacts"],
          properties: {
            id: { type: "string", minLength: 1 },
            title: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            scores: {
              type: "object",
              additionalProperties: false,
              required: ["userValue", "deliveryEffort", "operationalRisk", "complianceFit"],
              properties: {
                userValue: { type: "number", minimum: 1, maximum: 5 },
                deliveryEffort: { type: "number", minimum: 1, maximum: 5 },
                operationalRisk: { type: "number", minimum: 1, maximum: 5 },
                complianceFit: { type: "number", minimum: 1, maximum: 5 },
              },
            },
            impacts: {
              type: "object",
              additionalProperties: false,
              required: ["scope", "cost", "timeline", "risk"],
              properties: {
                scope: { enum: ["low", "medium", "high"] },
                cost: { enum: ["low", "medium", "high"] },
                timeline: { enum: ["low", "medium", "high"] },
                risk: { enum: ["low", "medium", "high"] },
              },
            },
          },
        },
      },
    },
  },
  signoffPacket: {
    $schema: JSON_SCHEMA_DRAFT,
    $id: "custom://schemas/signoff/v1.1",
    title: "Sign-off Packet Artifact v1.1",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "processId", "baselineVersion", "approvedAt", "approvers"],
    properties: {
      schemaVersion: { const: "signoff/v1.1" },
      processId: { type: "string", minLength: 1 },
      baselineVersion: { type: "string", minLength: 1 },
      approvedAt: { type: "string", format: "date-time" },
      approvers: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["stakeholderId", "role", "decision"],
          properties: {
            stakeholderId: { type: "string", minLength: 1 },
            role: { type: "string", minLength: 1 },
            decision: { enum: ["approved", "approvedWithConditions", "rejected"] },
            note: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

export function validateRequirementsArtifactV1(artifact: RequirementsArtifactV1): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "requirements/v1") {
    errors.push("schemaVersion must be requirements/v1.");
  }

  const stakeholderIds = new Set<string>();
  for (const stakeholder of artifact.stakeholders) {
    if (stakeholderIds.has(stakeholder.id)) {
      errors.push(`duplicate stakeholder id: ${stakeholder.id}`);
    }
    stakeholderIds.add(stakeholder.id);
  }

  const requirementIds = new Set<string>();
  for (const requirement of artifact.requirements) {
    if (requirementIds.has(requirement.id)) {
      errors.push(`duplicate requirement id: ${requirement.id}`);
    }
    requirementIds.add(requirement.id);

    if (!stakeholderIds.has(requirement.ownerStakeholderId)) {
      errors.push(
        `requirement ${requirement.id} references unknown ownerStakeholderId ${requirement.ownerStakeholderId}`,
      );
    }
  }

  for (const requirement of artifact.requirements) {
    for (const dependency of requirement.dependencies ?? []) {
      if (!requirementIds.has(dependency)) {
        errors.push(`requirement ${requirement.id} references unknown dependency ${dependency}`);
      }
    }
  }

  return errors;
}

export function validateConflictRegisterArtifactV1(
  artifact: ConflictRegisterArtifactV1,
  context?: { requirements?: RequirementsArtifactV1 },
): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "conflicts/v1") {
    errors.push("schemaVersion must be conflicts/v1.");
  }

  const conflictIds = new Set<string>();
  for (const conflict of artifact.conflicts) {
    if (conflictIds.has(conflict.id)) {
      errors.push(`duplicate conflict id: ${conflict.id}`);
    }
    conflictIds.add(conflict.id);
  }

  if (context?.requirements) {
    const reqIds = new Set(context.requirements.requirements.map((requirement) => requirement.id));
    const stakeholderIds = new Set(context.requirements.stakeholders.map((stakeholder) => stakeholder.id));
    for (const conflict of artifact.conflicts) {
      for (const requirementId of conflict.requirementIds) {
        if (!reqIds.has(requirementId)) {
          errors.push(`conflict ${conflict.id} references unknown requirement ${requirementId}`);
        }
      }
      for (const stakeholderId of conflict.stakeholderIds) {
        if (!stakeholderIds.has(stakeholderId)) {
          errors.push(`conflict ${conflict.id} references unknown stakeholder ${stakeholderId}`);
        }
      }
    }
  }

  return errors;
}

export function validateProcessGraphArtifactV1(artifact: ProcessGraphArtifactV1): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "process-graph/v1") {
    errors.push("schemaVersion must be process-graph/v1.");
  }

  const nodeIds = new Set<string>();
  for (const node of artifact.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of artifact.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      errors.push(`edge ${edge.id} references unknown source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`edge ${edge.id} references unknown target node ${edge.target}`);
    }
  }

  const triggers = artifact.nodes.filter((node) => node.type === "trigger");
  const ends = artifact.nodes.filter((node) => node.type === "end");
  if (!triggers.length) errors.push("process graph must contain at least one trigger node.");
  if (!ends.length) errors.push("process graph must contain at least one end node.");

  const edgesBySource = new Map<string, ProcessGraphArtifactV1["edges"]>();
  for (const edge of artifact.edges) {
    const edges = edgesBySource.get(edge.source) ?? [];
    edges.push(edge);
    edgesBySource.set(edge.source, edges);
  }

  for (const node of artifact.nodes) {
    if (node.type === "decision") {
      const outgoing = edgesBySource.get(node.id) ?? [];
      if (outgoing.length < 2) {
        errors.push(`decision node ${node.id} must have at least two outgoing edges.`);
      }
      if (outgoing.some((edge) => !edge.condition)) {
        errors.push(`decision node ${node.id} requires a condition on each outgoing edge.`);
      }
    }
  }

  return errors;
}

export function validateRequirementsArtifactV11(artifact: RequirementsArtifactV11): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "requirements/v1.1") {
    errors.push("schemaVersion must be requirements/v1.1.");
  }

  const stakeholderIds = new Set<string>();
  for (const stakeholder of artifact.stakeholders) {
    if (stakeholderIds.has(stakeholder.id)) {
      errors.push(`duplicate stakeholder id: ${stakeholder.id}`);
    }
    stakeholderIds.add(stakeholder.id);
  }

  const requirementIds = new Set<string>();
  for (const requirement of artifact.requirements) {
    if (requirementIds.has(requirement.id)) {
      errors.push(`duplicate requirement id: ${requirement.id}`);
    }
    requirementIds.add(requirement.id);
    if (!stakeholderIds.has(requirement.ownerStakeholderId)) {
      errors.push(
        `requirement ${requirement.id} references unknown ownerStakeholderId ${requirement.ownerStakeholderId}`,
      );
    }
    for (const stakeholderId of requirement.sourceStakeholderIds) {
      if (!stakeholderIds.has(stakeholderId)) {
        errors.push(`requirement ${requirement.id} references unknown source stakeholder ${stakeholderId}`);
      }
    }
  }

  for (const requirement of artifact.requirements) {
    for (const dependency of requirement.dependencies ?? []) {
      if (!requirementIds.has(dependency)) {
        errors.push(`requirement ${requirement.id} references unknown dependency ${dependency}`);
      }
    }
  }

  const raciActivityIds = new Set<string>();
  for (const assignment of artifact.raci) {
    if (raciActivityIds.has(assignment.activityId)) {
      errors.push(`duplicate RACI activity id: ${assignment.activityId}`);
    }
    raciActivityIds.add(assignment.activityId);
    if (!stakeholderIds.has(assignment.accountable)) {
      errors.push(`RACI activity ${assignment.activityId} references unknown accountable ${assignment.accountable}`);
    }
    for (const person of [...assignment.responsible, ...assignment.consulted, ...assignment.informed]) {
      if (!stakeholderIds.has(person)) {
        errors.push(`RACI activity ${assignment.activityId} references unknown stakeholder ${person}`);
      }
    }
  }

  const decisionIds = new Set<string>();
  for (const decision of artifact.decisionLog) {
    if (decisionIds.has(decision.id)) {
      errors.push(`duplicate decision log id: ${decision.id}`);
    }
    decisionIds.add(decision.id);
    if (!stakeholderIds.has(decision.ownerStakeholderId)) {
      errors.push(`decision ${decision.id} references unknown ownerStakeholderId ${decision.ownerStakeholderId}`);
    }
    for (const requirementId of decision.requirementIds) {
      if (!requirementIds.has(requirementId)) {
        errors.push(`decision ${decision.id} references unknown requirement ${requirementId}`);
      }
    }
  }

  return errors;
}

export function validateConflictRegisterArtifactV11(
  artifact: ConflictRegisterArtifactV11,
  context?: { requirements?: RequirementsArtifactV11 },
): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "conflicts/v1.1") {
    errors.push("schemaVersion must be conflicts/v1.1.");
  }

  const conflictIds = new Set<string>();
  for (const conflict of artifact.conflicts) {
    if (conflictIds.has(conflict.id)) {
      errors.push(`duplicate conflict id: ${conflict.id}`);
    }
    conflictIds.add(conflict.id);
  }

  if (context?.requirements) {
    const reqIds = new Set(context.requirements.requirements.map((requirement) => requirement.id));
    const stakeholderIds = new Set(context.requirements.stakeholders.map((stakeholder) => stakeholder.id));
    for (const conflict of artifact.conflicts) {
      if (!stakeholderIds.has(conflict.resolutionOwnerStakeholderId)) {
        errors.push(
          `conflict ${conflict.id} references unknown resolution owner ${conflict.resolutionOwnerStakeholderId}`,
        );
      }
      for (const requirementId of conflict.requirementIds) {
        if (!reqIds.has(requirementId)) {
          errors.push(`conflict ${conflict.id} references unknown requirement ${requirementId}`);
        }
      }
      for (const stakeholderId of conflict.stakeholderIds) {
        if (!stakeholderIds.has(stakeholderId)) {
          errors.push(`conflict ${conflict.id} references unknown stakeholder ${stakeholderId}`);
        }
      }
    }
  }

  return errors;
}

export function validateProcessGraphArtifactV11(
  artifact: ProcessGraphArtifactV11,
  context?: { requirements?: RequirementsArtifactV11 },
): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "process-graph/v1.1") {
    errors.push("schemaVersion must be process-graph/v1.1.");
  }

  const nodeIds = new Set<string>();
  for (const node of artifact.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);
    if (node.slaHours !== undefined && node.slaHours <= 0) {
      errors.push(`node ${node.id} must use slaHours greater than 0.`);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of artifact.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      errors.push(`edge ${edge.id} references unknown source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`edge ${edge.id} references unknown target node ${edge.target}`);
    }
  }

  const triggers = artifact.nodes.filter((node) => node.type === "trigger");
  const ends = artifact.nodes.filter((node) => node.type === "end");
  if (!triggers.length) errors.push("process graph must contain at least one trigger node.");
  if (!ends.length) errors.push("process graph must contain at least one end node.");

  const edgesBySource = new Map<string, ProcessGraphArtifactV11["edges"]>();
  for (const edge of artifact.edges) {
    const edges = edgesBySource.get(edge.source) ?? [];
    edges.push(edge);
    edgesBySource.set(edge.source, edges);
  }

  for (const node of artifact.nodes) {
    if (node.type === "decision") {
      const outgoing = edgesBySource.get(node.id) ?? [];
      if (outgoing.length < 2) {
        errors.push(`decision node ${node.id} must have at least two outgoing edges.`);
      }
      if (outgoing.some((edge) => !edge.condition)) {
        errors.push(`decision node ${node.id} requires a condition on each outgoing edge.`);
      }
    }
  }

  if (context?.requirements) {
    const stakeholderIds = new Set(context.requirements.stakeholders.map((stakeholder) => stakeholder.id));
    for (const node of artifact.nodes) {
      if (node.swimlaneStakeholderId && !stakeholderIds.has(node.swimlaneStakeholderId)) {
        errors.push(
          `node ${node.id} references unknown swimlaneStakeholderId ${node.swimlaneStakeholderId}`,
        );
      }
    }
  }

  return errors;
}

export function validateTradeoffRegisterArtifactV11(artifact: TradeoffRegisterArtifactV11): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "tradeoffs/v1.1") {
    errors.push("schemaVersion must be tradeoffs/v1.1.");
  }

  const optionIds = new Set<string>();
  for (const option of artifact.options) {
    if (optionIds.has(option.id)) {
      errors.push(`duplicate trade-off option id: ${option.id}`);
    }
    optionIds.add(option.id);
  }

  if (!optionIds.has(artifact.preferredOptionId)) {
    errors.push(`preferredOptionId ${artifact.preferredOptionId} does not match any trade-off option id.`);
  }

  return errors;
}

export function validateSignoffPacketArtifactV11(
  artifact: SignoffPacketArtifactV11,
  context?: { requirements?: RequirementsArtifactV11 },
): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== "signoff/v1.1") {
    errors.push("schemaVersion must be signoff/v1.1.");
  }

  const approverIds = new Set<string>();
  let approvedCount = 0;
  for (const approver of artifact.approvers) {
    if (approverIds.has(approver.stakeholderId)) {
      errors.push(`duplicate sign-off approver stakeholderId: ${approver.stakeholderId}`);
    }
    approverIds.add(approver.stakeholderId);
    if (approver.decision === "approved" || approver.decision === "approvedWithConditions") {
      approvedCount += 1;
    }
  }
  if (approvedCount === 0) {
    errors.push("sign-off packet requires at least one approving decision.");
  }

  if (context?.requirements) {
    const stakeholderIds = new Set(context.requirements.stakeholders.map((stakeholder) => stakeholder.id));
    for (const approver of artifact.approvers) {
      if (!stakeholderIds.has(approver.stakeholderId)) {
        errors.push(`sign-off approver references unknown stakeholderId ${approver.stakeholderId}`);
      }
    }
  }

  return errors;
}
