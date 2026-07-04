import { describe, it, expect } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions" project
// to resolve the module under test (the Deno source imports use .ts).
import {
  buildContactPayload,
  buildDocumentPayload,
  documentReference,
  selectSalesTaxRates,
} from "./payload";

const rate = (
  over: Partial<{
    id: string;
    name: string;
    percentage: string;
    tax_rate_type: string;
    active: boolean;
    show_tax: boolean;
  }>,
) => ({
  id: "1",
  name: "21% btw",
  percentage: "21.0",
  tax_rate_type: "sales_invoice",
  active: true,
  show_tax: true,
  ...over,
});

describe("documentReference", () => {
  it("uses distinct prefixes per document kind", () => {
    expect(documentReference("estimate", 42)).toBe("CRM-DEAL-42");
    expect(documentReference("invoice", 42)).toBe("CRM-INV-42");
    expect(documentReference("estimate", "42")).toBe("CRM-DEAL-42");
  });
});

describe("buildDocumentPayload", () => {
  const base = {
    deal: { id: 7, amount: 1000 },
    contactId: "478725052720743991",
    taxRateId: "478715074678097424",
    description: "Website onderhoud",
  };

  it("wraps an estimate under the estimate key with the deal reference", () => {
    const payload = buildDocumentPayload({ ...base, kind: "estimate" });
    expect("estimate" in payload).toBe(true);
    if ("estimate" in payload) {
      expect(payload.estimate.reference).toBe("CRM-DEAL-7");
      expect(payload.estimate.prices_are_incl_tax).toBe(false);
      expect(payload.estimate.currency).toBe("EUR");
      const line = payload.estimate.details_attributes[0];
      expect(line.price).toBe("1000"); // money value per unit
      expect(line.amount).toBe("1"); // QUANTITY, not money
      expect(line.tax_rate_id).toBe("478715074678097424");
    }
  });

  it("wraps an invoice under the sales_invoice key with the inv reference", () => {
    const payload = buildDocumentPayload({ ...base, kind: "invoice" });
    expect("sales_invoice" in payload).toBe(true);
    if ("sales_invoice" in payload) {
      expect(payload.sales_invoice.reference).toBe("CRM-INV-7");
      const line = payload.sales_invoice.details_attributes[0];
      expect(line.price).toBe("1000");
      expect(line.amount).toBe("1");
    }
  });

  it("falls back to a deal-id description when blank", () => {
    const payload = buildDocumentPayload({
      ...base,
      kind: "estimate",
      description: "   ",
    });
    if ("estimate" in payload) {
      expect(payload.estimate.details_attributes[0].description).toBe("Deal 7");
    }
  });

  it("refuses a deal without a positive amount", () => {
    expect(() =>
      buildDocumentPayload({
        ...base,
        kind: "invoice",
        deal: { id: 7, amount: 0 },
      }),
    ).toThrow();
    expect(() =>
      buildDocumentPayload({
        ...base,
        kind: "invoice",
        deal: { id: 7, amount: null },
      }),
    ).toThrow();
  });

  it("refuses a missing contact id or tax rate id", () => {
    expect(() =>
      buildDocumentPayload({ ...base, kind: "estimate", contactId: "" }),
    ).toThrow();
    expect(() =>
      buildDocumentPayload({ ...base, kind: "estimate", taxRateId: "" }),
    ).toThrow();
  });
});

describe("buildContactPayload", () => {
  it("always sends the company name and only present optional fields", () => {
    expect(
      buildContactPayload({
        name: "Acme BV",
        address: "Dorpsstraat 1",
        city: "",
      }).contact,
    ).toEqual({ company_name: "Acme BV", address1: "Dorpsstraat 1" });
  });

  it("forwards country only when it is a 2-letter ISO code, uppercased", () => {
    expect(
      buildContactPayload({ name: "Acme", country: "nl" }).contact.country,
    ).toBe("NL");
    expect(
      buildContactPayload({ name: "Acme", country: "Nederland" }).contact
        .country,
    ).toBeUndefined();
  });
});

describe("selectSalesTaxRates", () => {
  it("keeps only active sales-invoice rates", () => {
    const rates = [
      rate({ id: "sales-21", tax_rate_type: "sales_invoice", active: true }),
      rate({
        id: "purchase-21",
        tax_rate_type: "purchase_invoice",
        active: true,
      }),
      rate({
        id: "sales-inactive",
        tax_rate_type: "sales_invoice",
        active: false,
      }),
    ];
    expect(selectSalesTaxRates(rates).map((r) => r.id)).toEqual(["sales-21"]);
  });
});
