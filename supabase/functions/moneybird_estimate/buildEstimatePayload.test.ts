import { describe, it, expect } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions"
// project to resolve the module under test (the Deno source imports use .ts).
import {
  buildContactPayload,
  buildEstimatePayload,
  estimateReference,
  selectSalesTaxRates,
} from "./buildEstimatePayload";

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

describe("estimateReference", () => {
  it("builds a deterministic reference embedding the deal id", () => {
    expect(estimateReference(42)).toBe("CRM-DEAL-42");
    expect(estimateReference("42")).toBe("CRM-DEAL-42");
  });
});

describe("buildEstimatePayload", () => {
  const base = {
    deal: { id: 7, amount: 1000 },
    contactId: "478725052720743991",
    taxRateId: "478715074678097424",
    description: "Website onderhoud",
  };

  it("puts the money value in price and the quantity in amount (the naming trap)", () => {
    const line = buildEstimatePayload(base).estimate.details_attributes[0];
    expect(line.price).toBe("1000"); // money value per unit
    expect(line.amount).toBe("1"); // QUANTITY, not money
    expect(line.tax_rate_id).toBe("478715074678097424");
    expect(line.description).toBe("Website onderhoud");
  });

  it("sets a deterministic reference and prices excluding VAT", () => {
    const { estimate } = buildEstimatePayload(base);
    expect(estimate.reference).toBe("CRM-DEAL-7");
    expect(estimate.prices_are_incl_tax).toBe(false);
    expect(estimate.contact_id).toBe("478725052720743991");
    expect(estimate.currency).toBe("EUR");
  });

  it("allows overriding the currency", () => {
    expect(
      buildEstimatePayload({ ...base, currency: "USD" }).estimate.currency,
    ).toBe("USD");
  });

  it("falls back to a deal-id description when the description is blank", () => {
    const line = buildEstimatePayload({
      ...base,
      description: "   ",
    }).estimate.details_attributes[0];
    expect(line.description).toBe("Deal 7");
  });

  it("refuses a deal without a positive amount", () => {
    expect(() =>
      buildEstimatePayload({ ...base, deal: { id: 7, amount: 0 } }),
    ).toThrow();
    expect(() =>
      buildEstimatePayload({ ...base, deal: { id: 7, amount: null } }),
    ).toThrow();
    expect(() =>
      buildEstimatePayload({ ...base, deal: { id: 7, amount: -5 } }),
    ).toThrow();
  });

  it("refuses a missing contact id or tax rate id", () => {
    expect(() => buildEstimatePayload({ ...base, contactId: "" })).toThrow();
    expect(() => buildEstimatePayload({ ...base, taxRateId: "" })).toThrow();
  });
});

describe("buildContactPayload", () => {
  it("always sends the company name", () => {
    expect(buildContactPayload({ name: "Acme BV" }).contact).toEqual({
      company_name: "Acme BV",
    });
  });

  it("includes optional address fields only when present", () => {
    const { contact } = buildContactPayload({
      name: "Acme BV",
      address: "Dorpsstraat 1",
      zipcode: "1234 AB",
      city: "Amsterdam",
      tax_identifier: "NL0001",
    });
    expect(contact).toEqual({
      company_name: "Acme BV",
      address1: "Dorpsstraat 1",
      zipcode: "1234 AB",
      city: "Amsterdam",
      tax_number: "NL0001",
    });
  });

  it("forwards country only when it is a 2-letter ISO code, uppercased", () => {
    expect(
      buildContactPayload({ name: "Acme", country: "nl" }).contact.country,
    ).toBe("NL");
    expect(
      buildContactPayload({ name: "Acme", country: "Nederland" }).contact
        .country,
    ).toBeUndefined();
    expect(
      buildContactPayload({ name: "Acme", country: "USA" }).contact.country,
    ).toBeUndefined();
  });

  it("ignores empty-string optional fields", () => {
    expect(
      buildContactPayload({ name: "Acme", address: "", city: "" }).contact,
    ).toEqual({ company_name: "Acme" });
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

  it("returns an empty list when nothing qualifies", () => {
    expect(
      selectSalesTaxRates([rate({ tax_rate_type: "purchase_invoice" })]),
    ).toEqual([]);
  });
});
