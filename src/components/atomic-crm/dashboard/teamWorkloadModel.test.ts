import type { Deal, Task } from "../types";
import { buildTeamWorkload } from "./teamWorkloadModel";

const now = new Date(2026, 6, 14, 12);

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1_000,
  category: "seo",
  company_id: 1,
  contact_ids: [],
  created_at: "2026-07-01T09:00:00.000Z",
  description: null,
  expected_closing_date: "2026-07-31",
  id: 1,
  index: 0,
  name: "SEO-retainer",
  sales_id: 1,
  stage: "bezig",
  updated_at: "2026-07-12T09:00:00.000Z",
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  contact_id: null,
  deal_id: 1,
  due_date: "2026-07-20",
  id: 100,
  text: "Opvolgen",
  type: "follow-up",
  ...overrides,
});

describe("buildTeamWorkload", () => {
  it("splits the open work per owner, with its value", () => {
    const rows = buildTeamWorkload(
      [
        deal({ id: 1, sales_id: 1, amount: 2_000 }),
        deal({ id: 2, sales_id: 1, amount: 3_000 }),
        deal({ id: 3, sales_id: 2, amount: 500 }),
      ],
      [
        // All three are planned, so nothing is off-track and the order falls
        // back to who carries the most.
        task({ id: 100, deal_id: 1 }),
        task({ id: 101, deal_id: 2 }),
        task({ id: 102, deal_id: 3 }),
      ],
      now,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.salesId)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ oneOffAmount: 5_000, open: 2 });
    expect(rows[1]).toMatchObject({ oneOffAmount: 500, open: 1 });
  });

  it("counts what is off-track and ranks the busiest owner first", () => {
    const rows = buildTeamWorkload(
      [
        deal({ id: 1, sales_id: 1 }),
        deal({ id: 2, sales_id: 2 }),
        deal({ id: 3, sales_id: 2 }),
      ],
      [
        // Owner 2 is late twice, owner 1 is planned for next week.
        task({ id: 100, deal_id: 2, due_date: "2026-07-01" }),
        task({ id: 101, deal_id: 3, due_date: "2026-07-02" }),
        task({ id: 102, deal_id: 1, due_date: "2026-07-20" }),
      ],
      now,
    );

    expect(rows[0].salesId).toBe(2);
    expect(rows[0].attention.overdue).toBe(2);
    expect(rows[1].attention.overdue).toBe(0);
  });

  it("keeps a monthly fee apart from a one-off project price", () => {
    const rows = buildTeamWorkload(
      [
        deal({
          id: 1,
          sales_id: 1,
          amount: 300,
          revenue_period: "maandelijks",
        }),
        deal({ id: 2, sales_id: 1, amount: 5_000, revenue_period: "eenmalig" }),
        deal({ id: 3, sales_id: 1, amount: 750 }),
      ],
      [],
      now,
    );

    // 300 per month next to 5.750 once: adding them would be meaningless.
    expect(rows[0]).toMatchObject({ monthlyAmount: 300, oneOffAmount: 5_750 });
  });

  it("keeps unclaimed work visible, and always last", () => {
    const rows = buildTeamWorkload(
      [
        deal({ id: 1, sales_id: undefined }),
        deal({ id: 2, sales_id: undefined }),
        deal({ id: 3, sales_id: 1 }),
      ],
      [],
      now,
    );

    expect(rows.at(-1)).toMatchObject({ open: 2, salesId: null });
  });

  it("leaves finished and archived work out of the split", () => {
    const rows = buildTeamWorkload(
      [
        deal({ id: 1, sales_id: 1 }),
        deal({ id: 2, sales_id: 1, stage: "won" }),
        deal({ id: 3, sales_id: 1, archived_at: "2026-07-10T09:00:00.000Z" }),
      ],
      [],
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].open).toBe(1);
  });
});
