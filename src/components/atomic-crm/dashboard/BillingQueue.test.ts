import type { Deal } from "../types";
import { getBillingState } from "./billingQueueModel";

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    amount: 1000,
    category: "seo",
    company_id: 1,
    contact_ids: [2],
    created_at: "2026-07-01T09:00:00.000Z",
    description: null,
    expected_closing_date: "2026-07-31",
    id: 1,
    index: 0,
    name: "SEO",
    sales_id: 1,
    stage: "facturatie-live",
    updated_at: "2026-07-10T09:00:00.000Z",
    ...overrides,
  }) as Deal;

describe("getBillingState", () => {
  it("distinguishes ready, incomplete, failed and completed billing", () => {
    expect(getBillingState(deal())).toMatchObject({ kind: "ready" });
    expect(getBillingState(deal({ amount: null, contact_ids: [] }))).toEqual({
      kind: "incomplete",
      label: "Mist contact, bedrag",
    });
    expect(
      getBillingState(deal({ moneybird_invoice_status: "failed" })),
    ).toMatchObject({ kind: "failed" });
    expect(
      getBillingState(
        deal({
          moneybird_invoice_id: "invoice-1",
          moneybird_invoice_status: "completed",
        }),
      ),
    ).toBeNull();
  });
});
