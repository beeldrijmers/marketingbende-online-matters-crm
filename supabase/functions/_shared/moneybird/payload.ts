// Pure payload builders and selectors — no Deno/Supabase/network imports (types
// only), so this module is trivially unit-testable in Node via Vitest. All
// Moneybird-specific mapping decisions live here with WHY-comments.

import { UserFacingError } from "./errors.ts";
import type {
  DocumentKind,
  MoneybirdContactInput,
  MoneybirdDocumentInput,
  MoneybirdTaxRate,
} from "./types.ts";

// Only active, sales-invoice-type tax rates may appear on a document (the
// purchase-invoice 21% rate is a different id and is wrong here). Shared by the
// GET handler (dropdown contents) and the POST handler (server-side validation).
export const selectSalesTaxRates = (
  rates: MoneybirdTaxRate[],
): MoneybirdTaxRate[] =>
  rates.filter((rate) => rate.active && rate.tax_rate_type === "sales_invoice");

// Deterministic, NOT user-editable reference embedding the CRM deal id, so a
// retry after a network timeout can find an already-created document instead of
// creating a second one. Estimates and invoices use distinct prefixes so they
// are unambiguous in Moneybird (and never reconcile against each other).
export const documentReference = (
  kind: DocumentKind,
  dealId: string | number,
): string => (kind === "estimate" ? `CRM-DEAL-${dealId}` : `CRM-INV-${dealId}`);

export interface DealForDocument {
  id: string | number;
  // CRM stores the deal amount in whole currency units (e.g. 1000 = EUR 1000),
  // not cents.
  amount: number | null;
}

export const buildDocumentPayload = ({
  kind,
  deal,
  contactId,
  taxRateId,
  description,
  currency = "EUR",
}: {
  kind: DocumentKind;
  deal: DealForDocument;
  contactId: string;
  taxRateId: string;
  description: string;
  currency?: string;
}): MoneybirdDocumentInput => {
  // A real financial document must never be created with a zero/blank amount.
  // User-facing: the frontend guards this too, but a race (a colleague
  // clearing the amount between opening the dialog and submitting) must end
  // in a message the user can act on.
  if (!deal.amount || deal.amount <= 0) {
    throw new UserFacingError(
      "Dit deal heeft geen positief bedrag; vul eerst een bedrag in op het deal.",
    );
  }
  if (!contactId) {
    throw new Error("Missing Moneybird contact id");
  }
  if (!taxRateId) {
    throw new Error("Missing tax rate id");
  }

  const cleanDescription = description.trim() || `Deal ${deal.id}`;

  const body = {
    contact_id: contactId,
    reference: documentReference(kind, deal.id),
    // Prices are entered EXCLUSIVE of VAT (matches every existing document in
    // this administration); Moneybird computes the incl-VAT totals server-side.
    prices_are_incl_tax: false,
    currency,
    details_attributes: [
      {
        description: cleanDescription,
        // CRITICAL: `amount` is the QUANTITY, NOT the money value. The money
        // value goes in `price`.
        amount: "1",
        price: String(deal.amount),
        tax_rate_id: taxRateId,
      },
    ],
  };

  // Wrap under the endpoint-specific key.
  return kind === "estimate" ? { estimate: body } : { sales_invoice: body };
};

export interface CompanyForContact {
  name: string;
  address?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  tax_identifier?: string | null;
}

export const buildContactPayload = (
  company: CompanyForContact,
): MoneybirdContactInput => {
  const contact: MoneybirdContactInput["contact"] = {
    company_name: company.name,
  };

  // Only include optional fields when actually present.
  if (company.address) contact.address1 = company.address;
  if (company.zipcode) contact.zipcode = company.zipcode;
  if (company.city) contact.city = company.city;
  // Moneybird expects a 2-letter ISO country code; the CRM stores free-text
  // names, so only forward a value that is already a 2-letter code.
  if (company.country && company.country.trim().length === 2) {
    contact.country = company.country.trim().toUpperCase();
  }
  if (company.tax_identifier) contact.tax_number = company.tax_identifier;

  return { contact };
};
