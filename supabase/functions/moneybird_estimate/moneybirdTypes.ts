// Shared Moneybird REST API v2 types for the moneybird_estimate function.
//
// CRITICAL: every Moneybird id (administration, tax rate, contact, estimate,
// detail line) is an ~18-digit integer that exceeds Number.MAX_SAFE_INTEGER.
// They are therefore ALWAYS strings here and everywhere downstream — never
// parse them into JS numbers or the least-significant digits corrupt.

export interface MoneybirdTaxRate {
  id: string;
  name: string;
  // Moneybird returns the percentage as a decimal string ("21.0", "9.0",
  // "0.0") or an empty string for the "Geen btw" rate (no VAT line at all).
  percentage: string;
  // "sales_invoice" | "purchase_invoice" | "general_journal_document".
  // Estimates MUST use a sales_invoice-type rate — the purchase-type 21% rate
  // is a different id and is wrong for an estimate.
  tax_rate_type: string;
  active: boolean;
  show_tax: boolean;
}

export interface MoneybirdContact {
  id: string;
  company_name: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
}

export interface MoneybirdEstimateDetail {
  id: string;
  description: string;
  // QUANTITY, not a money value. Decimal string ("1", "0.5", "3.5").
  amount: string;
  // Money value PER UNIT. Decimal string. Ex/incl VAT is governed by the
  // estimate-level `prices_are_incl_tax` flag.
  price: string;
  tax_rate_id: string | null;
}

export interface MoneybirdEstimate {
  id: string;
  contact_id: string;
  reference: string | null;
  state: string;
  estimate_id: string | null;
  total_price_incl_tax: string | null;
  total_price_excl_tax: string | null;
  // The GET/list response calls the line-item array "details" (the WRITE
  // request calls the same array "details_attributes").
  details: MoneybirdEstimateDetail[];
}

// ---- request payload shapes (what we POST) ----

export interface MoneybirdEstimateDetailInput {
  description: string;
  amount: string; // quantity
  price: string; // per-unit money value
  tax_rate_id: string;
}

export interface MoneybirdEstimateInput {
  estimate: {
    contact_id: string;
    reference: string;
    // Explicitly false: all existing estimates in this administration enter
    // prices EXCLUSIVE of VAT. Verified against historical estimates.
    prices_are_incl_tax: boolean;
    currency: string;
    details_attributes: MoneybirdEstimateDetailInput[];
  };
}

export interface MoneybirdContactInput {
  contact: {
    company_name?: string;
    firstname?: string;
    lastname?: string;
    address1?: string;
    zipcode?: string;
    city?: string;
    country?: string;
    email?: string;
    tax_number?: string;
  };
}
