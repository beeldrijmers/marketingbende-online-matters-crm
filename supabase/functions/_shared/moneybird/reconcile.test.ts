import { describe, expect, it } from "vitest";

import { autoReconcileMatch, rankMoneybirdDocuments } from "./reconcile.ts";
import type { MoneybirdDocument } from "./types.ts";

const document = (
  id: string,
  overrides: Partial<MoneybirdDocument> = {},
): MoneybirdDocument => ({
  id,
  contact_id: "contact-1",
  reference: null,
  state: "draft",
  total_price_incl_tax: "907.50",
  total_price_excl_tax: "750.00",
  details: [
    {
      id: `detail-${id}`,
      description: "Website Valora Incasso",
      amount: "1",
      price: "750.00",
      tax_rate_id: "tax-1",
    },
  ],
  ...overrides,
});

describe("Moneybird document reconciliation", () => {
  it("always selects an exact deterministic CRM reference", () => {
    const matches = rankMoneybirdDocuments({
      kind: "invoice",
      dealId: 42,
      dealName: "Valora Incasso — website",
      amount: 750,
      contactId: "contact-1",
      documents: [document("1"), document("2", { reference: "CRM-INV-42" })],
    });
    expect(autoReconcileMatch(matches)?.document.id).toBe("2");
  });

  it("adopts one strong legacy match but leaves ambiguity unresolved", () => {
    const input = {
      kind: "invoice" as const,
      dealId: 42,
      dealName: "Valora Incasso — website",
      amount: 750,
      contactId: "contact-1",
    };
    expect(
      autoReconcileMatch(
        rankMoneybirdDocuments({ ...input, documents: [document("1")] }),
      )?.document.id,
    ).toBe("1");
    expect(
      autoReconcileMatch(
        rankMoneybirdDocuments({
          ...input,
          documents: [document("1"), document("2")],
        }),
      ),
    ).toBeNull();
  });

  it("keeps other documents for the same company visible for manual review", () => {
    const matches = rankMoneybirdDocuments({
      kind: "estimate",
      dealId: 43,
      dealName: "Nieuwe opdracht zonder bedrag",
      amount: null,
      contactId: "contact-1",
      documents: [
        document("legacy", {
          total_price_excl_tax: "125.00",
          details: [],
        }),
        document("other-contact", { contact_id: "contact-2" }),
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      document: { id: "legacy" },
      confidence: "possible",
      reasons: ["Zelfde bedrijf in Moneybird"],
    });
    expect(autoReconcileMatch(matches)).toBeNull();
  });
});
