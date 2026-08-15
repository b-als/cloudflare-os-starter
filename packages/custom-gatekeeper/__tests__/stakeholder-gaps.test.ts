import { describe, expect, it } from "vitest";
import { findStakeholderGaps } from "../src/ba-schema.js";
import type { RequirementItemV11 } from "../src/types.js";

function requirement(overrides: Partial<RequirementItemV11>): RequirementItemV11 {
  return {
    id: "req-1",
    title: "Sample requirement",
    category: "functional",
    statement: "Statement.",
    acceptanceCriteria: ["criterion"],
    priority: "must",
    ownerStakeholderId: "st-owner",
    sourceStakeholderIds: ["st-owner"],
    fitCriterion: "fit",
    benefitHypothesis: "benefit",
    ...overrides,
  };
}

describe("findStakeholderGaps", () => {
  it("flags a compliance requirement with no matching stakeholder role", () => {
    const gaps = findStakeholderGaps({
      stakeholders: [{ id: "st-owner", name: "Owner", role: "process-owner" }],
      requirements: [requirement({ category: "compliance", title: "Run risk triage" })],
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ role: "compliance", source: "gapAnalysis" });
    expect(gaps[0].reason).toContain("Run risk triage");
  });

  it("does not flag a category once a matching stakeholder role is registered", () => {
    const gaps = findStakeholderGaps({
      stakeholders: [
        { id: "st-owner", name: "Owner", role: "process-owner" },
        { id: "st-risk", name: "Risk lead", role: "Risk and Compliance" },
      ],
      requirements: [requirement({ category: "compliance" })],
    });
    expect(gaps).toHaveLength(0);
  });

  it("never flags functional requirements (no expected role keywords)", () => {
    const gaps = findStakeholderGaps({
      stakeholders: [{ id: "st-owner", name: "Owner", role: "process-owner" }],
      requirements: [requirement({ category: "functional" })],
    });
    expect(gaps).toHaveLength(0);
  });

  it("only reports one gap per category even with multiple matching requirements", () => {
    const gaps = findStakeholderGaps({
      stakeholders: [{ id: "st-owner", name: "Owner", role: "process-owner" }],
      requirements: [
        requirement({ id: "req-1", category: "integration" }),
        requirement({ id: "req-2", category: "integration" }),
      ],
    });
    expect(gaps).toHaveLength(1);
  });
});
