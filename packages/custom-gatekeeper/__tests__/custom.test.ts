import { describe, expect, it } from "vitest";
import {
  describeCustomAccount,
  describeCustomVendor,
} from "../src/custom.js";
import TYPES_CODE from "../src/types-code.js";

describe("custom-gatekeeper", () => {
  it("describes the finance capability as an auto-provisioned singleton", () => {
    expect(describeCustomVendor()).toMatchObject({
      displayName: "Finance Operations",
      autoProvisionsAccount: true,
      providesAuth: false,
    });
    expect(describeCustomAccount()).toMatchObject({
      displayName: "Synthetic Finance Workspace",
      singleton: { tsType: "CustomSession" },
    });
  });

  it("exposes governed invoice operations to the agent", () => {
    expect(TYPES_CODE).toContain("listPendingInvoices");
    expect(TYPES_CODE).toContain("explainBlockedInvoice");
    expect(TYPES_CODE).toContain("requestInvoiceApproval");
    expect(TYPES_CODE).not.toContain("approveInvoice():");
  });
});
