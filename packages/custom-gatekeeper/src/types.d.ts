export type InvoiceStatus = "awaiting_approval" | "blocked" | "approved";

export interface Invoice {
  id: string;
  supplier: string;
  amount: number;
  currency: "GBP";
  purchaseOrder: string | null;
  owner: string;
  status: InvoiceStatus;
  blockedReason?: string;
  requiredApprover: string;
}

export interface ApprovalRequest {
  invoiceId: string;
  submitted: true;
  message: string;
}

/** Governed finance capability exposed to the Cloudflare OS agent. */
export interface CustomSession {
  /** List invoices currently waiting for attention. */
  listPendingInvoices(): Promise<Invoice[]>;

  /** Read one invoice and its current workflow state. */
  getInvoice(invoiceId: string): Promise<Invoice | null>;

  /** Explain the deterministic reason an invoice cannot progress. */
  explainBlockedInvoice(invoiceId: string): Promise<string>;

  /** Submit approval progression as a governed side-effecting action. */
  requestInvoiceApproval(invoiceId: string): Promise<ApprovalRequest>;
}
