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

  // Geen contact-eis: het factuurpad zoekt de Moneybird-relatie op bedrijfsnaam
  // (_shared/moneybird/contact.ts) en leest contact_ids nergens. De knop op de
  // opdracht zelf blokkeert dan ook alleen op bedrijf, bedrag en valuta, dus
  // deze rij sprak de rest van de app tegen.
  const missing = [
    !deal.company_id ? "bedrijf" : null,
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
