import type { Deal } from "../types";

export type BillingState =
  | { kind: "failed"; label: string }
  | { kind: "incomplete"; label: string }
  | { kind: "pending"; label: string }
  | { kind: "ready"; label: string };

export const getBillingState = (deal: Deal): BillingState | null => {
  if (
    deal.moneybird_invoice_id &&
    deal.moneybird_invoice_status === "completed"
  ) {
    return null;
  }
  if (deal.moneybird_invoice_status === "failed") {
    return { kind: "failed", label: "Moneybird-fout controleren" };
  }
  if (deal.moneybird_invoice_status === "pending") {
    return { kind: "pending", label: "Factuur wordt aangemaakt" };
  }

  const missing = [
    !deal.company_id ? "bedrijf" : null,
    !deal.contact_ids?.length ? "contact" : null,
    !deal.amount || deal.amount <= 0 ? "bedrag" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      kind: "incomplete",
      label: `Mist ${missing.join(", ")}`,
    };
  }
  return { kind: "ready", label: "Klaar om te factureren" };
};
