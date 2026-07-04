// Pure payload builders — no Deno/Supabase/network imports (types only), so
// this module is trivially unit-testable in Node via Vitest, mirroring
// trello-sync/resolveDealFields.ts. All Moneybird-specific mapping decisions
// live here with WHY-comments; the client module stays I/O-only.

import type {
  MoneybirdContactInput,
  MoneybirdEstimateInput,
  MoneybirdTaxRate,
} from "./moneybirdTypes.ts";

// Only active, sales-invoice-type tax rates may appear on an estimate (the
// purchase-invoice 21% rate is a different id and is wrong for an estimate).
// Shared by the GET handler (dropdown contents) and the POST handler
// (server-side validation of the client-supplied taxRateId) so the two cannot
// drift apart.
export const selectSalesTaxRates = (
  rates: MoneybirdTaxRate[],
): MoneybirdTaxRate[] =>
  rates.filter((rate) => rate.active && rate.tax_rate_type === "sales_invoice");

// Deterministic, NOT user-editable reference. It embeds the CRM deal id so a
// retry after a network timeout can find an already-created estimate instead of
// creating a second one (see moneybirdClient.findEstimateByReference).
export const ESTIMATE_REFERENCE_PREFIX = "CRM-DEAL-";

export const estimateReference = (dealId: string | number): string =>
  `${ESTIMATE_REFERENCE_PREFIX}${dealId}`;

export interface DealForEstimate {
  id: string | number;
  // CRM stores the deal amount in whole currency units (e.g. 1000 = EUR 1000),
  // not cents — confirmed by the app formatting record.amount with a currency
  // style directly.
  amount: number | null;
}

export const buildEstimatePayload = ({
  deal,
  contactId,
  taxRateId,
  description,
  currency = "EUR",
}: {
  deal: DealForEstimate;
  contactId: string;
  taxRateId: string;
  description: string;
  currency?: string;
}): MoneybirdEstimateInput => {
  // A real financial document must never be created with a zero/blank amount;
  // there is no safe default for money. The frontend blocks this too, but the
  // edge function must not trust the client.
  if (!deal.amount || deal.amount <= 0) {
    throw new Error("Deal has no positive amount to put on the estimate");
  }
  if (!contactId) {
    throw new Error("Missing Moneybird contact id");
  }
  if (!taxRateId) {
    throw new Error("Missing tax rate id");
  }

  const cleanDescription = description.trim() || `Deal ${deal.id}`;

  return {
    estimate: {
      contact_id: contactId,
      reference: estimateReference(deal.id),
      // prices are entered EXCLUSIVE of VAT (matches every existing estimate in
      // this administration); Moneybird computes the incl-VAT totals server-side.
      prices_are_incl_tax: false,
      currency,
      details_attributes: [
        {
          description: cleanDescription,
          // CRITICAL: `amount` is the QUANTITY (one line of the whole deal),
          // NOT the money value. The money value goes in `price`.
          amount: "1",
          price: String(deal.amount),
          tax_rate_id: taxRateId,
        },
      ],
    },
  };
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

  // Only include optional fields when actually present. Sending empty strings
  // would clutter the Moneybird contact card; a missing company address is a
  // valid state (the estimate is still created for the company).
  if (company.address) contact.address1 = company.address;
  if (company.zipcode) contact.zipcode = company.zipcode;
  if (company.city) contact.city = company.city;
  // Moneybird expects a 2-letter ISO country code. The CRM stores free-text
  // country names ("Nederland", "USA", ...), so only forward a value that is
  // already a 2-letter code; otherwise let Moneybird apply the admin default.
  if (company.country && company.country.trim().length === 2) {
    contact.country = company.country.trim().toUpperCase();
  }
  if (company.tax_identifier) contact.tax_number = company.tax_identifier;

  return { contact };
};
