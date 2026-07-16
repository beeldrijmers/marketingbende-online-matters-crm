import type { Deal, Task } from "../types";
import {
  filterAttentionDeals,
  filterAttentionDealsBySearch,
  parseAttentionPipelineFilter,
  selectAttentionDeals,
  selectAttentionDealIds,
  selectBillingDealIds,
} from "./dashboardDealKanbanModel";

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1000,
  category: "seo",
  company_id: 1,
  contact_ids: [2],
  created_at: "2026-07-01T09:00:00.000Z",
  description: null,
  expected_closing_date: "2026-07-31",
  id: 1,
  index: 0,
  name: "SEO-retainer",
  sales_id: 1,
  stage: "bezig",
  updated_at: "2026-07-10T09:00:00.000Z",
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  contact_id: null,
  deal_id: 1,
  due_date: "2026-07-15",
  id: 10,
  text: "Controle uitvoeren",
  type: "none",
  ...overrides,
});

describe("dedicated dashboard Kanban pages", () => {
  it("selects exactly the deals that need attention", () => {
    const deals = [
      deal({ id: 1 }),
      deal({ id: 2 }),
      deal({ id: 3, stage: "on-hold" }),
    ];
    const tasks = [
      task({ deal_id: 1, due_date: "2026-07-15" }),
      task({ deal_id: 2, due_date: "2026-07-20", id: 11 }),
    ];

    expect(
      selectAttentionDealIds(deals, tasks, "all", new Date(2026, 6, 15, 12)),
    ).toEqual([1]);
  });

  it("filters the attention pipeline without changing its urgency order", () => {
    const deals = [deal({ id: 1 }), deal({ id: 2 }), deal({ id: 3 })];
    const tasks = [
      task({ deal_id: 1, due_date: "2026-07-14" }),
      task({ deal_id: 2, due_date: "2026-07-15", id: 11 }),
    ];
    const ranked = selectAttentionDeals(
      deals,
      tasks,
      new Date(2026, 6, 15, 12),
    );

    expect(
      filterAttentionDeals(ranked, "overdue").map(({ deal }) => deal.id),
    ).toEqual([1]);
    expect(
      filterAttentionDeals(ranked, "today").map(({ deal }) => deal.id),
    ).toEqual([2]);
    expect(
      filterAttentionDeals(ranked, "unplanned").map(({ deal }) => deal.id),
    ).toEqual([3]);
    expect(
      filterAttentionDeals(ranked, "all").map(({ deal }) => deal.id),
    ).toEqual([1, 2, 3]);
  });

  it("keeps attention filters safe and refreshable through the URL", () => {
    expect(parseAttentionPipelineFilter("today")).toBe("today");
    expect(parseAttentionPipelineFilter("not-a-filter")).toBe("all");
    expect(parseAttentionPipelineFilter(null)).toBe("all");
  });

  it("searches deal, description and company using all normalized terms", () => {
    const ranked = selectAttentionDeals(
      [
        deal({ id: 1, company_id: 8, name: "SEO-retainer" }),
        deal({
          id: 2,
          company_id: 9,
          description: "Nieuwe meertalige webshop",
          name: "Realisatie",
        }),
      ],
      [],
      new Date(2026, 6, 15, 12),
    );
    const companies = new Map([
      [8, "Voodoo Software"],
      [9, "Stöökmeesters"],
    ]);

    expect(
      filterAttentionDealsBySearch(ranked, "voodoo seo", companies).map(
        ({ deal }) => deal.id,
      ),
    ).toEqual([1]);
    expect(
      filterAttentionDealsBySearch(ranked, "stook meertalig", companies).map(
        ({ deal }) => deal.id,
      ),
    ).toEqual([2]);
    expect(filterAttentionDealsBySearch(ranked, "", companies)).toBe(ranked);
  });

  it("selects only unfinished deals in the billing stage", () => {
    const deals = [
      deal({ id: 1, stage: "facturatie-live" }),
      deal({ id: 2, stage: "bezig" }),
      deal({
        id: 3,
        moneybird_invoice_id: "invoice-3",
        moneybird_invoice_status: "completed",
        stage: "facturatie-live",
      }),
    ];

    expect(selectBillingDealIds(deals)).toEqual([1]);
  });
});
