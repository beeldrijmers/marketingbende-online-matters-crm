// Shared Moneybird REST API v2 types, used by both the moneybird_estimate and
// moneybird_invoice edge functions.
//
// CRITICAL: every Moneybird id (administration, tax rate, contact, estimate,
// invoice, detail line) is an ~18-digit integer that exceeds
// Number.MAX_SAFE_INTEGER. They are therefore ALWAYS strings here and
// everywhere downstream — never parse them into JS numbers.

// Which kind of financial document we create from a deal. The two share almost
// all logic; only the Moneybird endpoint, the request wrapper key, the DB
// column set, and the reference prefix differ.
export type DocumentKind = "estimate" | "invoice";

// An administration a personal API token has access to, as returned by the
// non-scoped /administrations.json endpoint (used at connect time).
export interface MoneybirdAdministration {
  id: string;
  name: string;
}

export interface MoneybirdTaxRate {
  id: string;
  name: string;
  // Decimal string ("21.0", "9.0", "0.0") or empty for the "Geen btw" rate.
  percentage: string;
  // "sales_invoice" | "purchase_invoice" | ... — a document MUST use a
  // sales_invoice-type rate.
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

export interface MoneybirdDocumentDetail {
  id: string;
  description: string;
  // QUANTITY, not a money value. Decimal string ("1", "0.5", "3.5").
  amount: string;
  // Money value PER UNIT. Ex/incl VAT is governed by the document-level
  // `prices_are_incl_tax` flag.
  price: string;
  tax_rate_id: string | null;
}

// The response shape is the same for estimates and sales invoices for the
// fields we care about (the READ arrays are both called "details").
export interface MoneybirdDocument {
  id: string;
  contact_id: string;
  reference: string | null;
  state: string;
  total_price_incl_tax: string | null;
  total_price_excl_tax: string | null;
  details: MoneybirdDocumentDetail[];
  created_at?: string | null;
  updated_at?: string | null;
  date?: string | null;
  due_date?: string | null;
}

// ---- request payload shapes (what we POST) ----

export interface MoneybirdDocumentDetailInput {
  description: string;
  amount: string; // quantity
  price: string; // per-unit money value
  tax_rate_id: string;
}

// The inner body shared by estimate/invoice creation. It is wrapped under
// "estimate" or "sales_invoice" by buildDocumentPayload.
export interface MoneybirdDocumentBody {
  contact_id: string;
  reference: string;
  // Explicitly false: this administration enters prices EXCLUSIVE of VAT.
  prices_are_incl_tax: boolean;
  currency: string;
  details_attributes: MoneybirdDocumentDetailInput[];
}

export type MoneybirdDocumentInput =
  | { estimate: MoneybirdDocumentBody }
  | { sales_invoice: MoneybirdDocumentBody };

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
