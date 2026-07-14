import type { Deal, Task } from "../types";
import {
  buildOpenTasksByDeal,
  getDealWorkflow,
  rankDealsForAttention,
  summarizeDealAttention,
} from "./dealWorkflow";

const now = new Date(2026, 6, 14, 12);

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1000,
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
  updated_at: "2026-07-10T09:00:00.000Z",
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  contact_id: null,
  deal_id: 1,
  due_date: "2026-07-20",
  id: 10,
  text: "Controle uitvoeren",
  type: "none",
  ...overrides,
});

describe("dealWorkflow", () => {
  it("groups only open deal tasks and orders dated work first", () => {
    const tasks = buildOpenTasksByDeal([
      task({ id: 1, due_date: "", text: "Zonder datum" }),
      task({ id: 2, due_date: "2026-07-15", text: "Morgen" }),
      task({ id: 3, done_date: "2026-07-14", text: "Afgerond" }),
      task({ id: 4, deal_id: null, text: "Contacttaak" }),
    ]);

    expect(tasks.get(1)?.map((item) => item.id)).toEqual([2, 1]);
  });

  it.each([
    ["2026-07-13", "overdue"],
    ["2026-07-14", "today"],
    ["2026-07-15", "scheduled"],
    ["", "unscheduled"],
  ] as const)("classifies a next task due %s as %s", (dueDate, kind) => {
    expect(
      getDealWorkflow(deal(), [task({ due_date: dueDate })], now),
    ).toMatchObject({
      kind,
      openTaskCount: 1,
    });
  });

  it("flags an expired deal plan when there is no open task", () => {
    expect(
      getDealWorkflow(deal({ expected_closing_date: "2026-07-13" }), [], now)
        .kind,
    ).toBe("overdue_closing");
  });

  it("flags expired planning even when the next task is in the future", () => {
    expect(
      getDealWorkflow(
        deal({ expected_closing_date: "2026-07-13" }),
        [task({ due_date: "2026-07-20" })],
        now,
      ),
    ).toMatchObject({
      kind: "overdue_closing",
      nextTask: { id: 10 },
    });
  });

  it("does not demand a next action for paused or completed work", () => {
    expect(
      getDealWorkflow(deal({ stage: "on-hold" }), [task()], now).kind,
    ).toBe("on_hold");
    expect(getDealWorkflow(deal({ stage: "won" }), [], now).kind).toBe(
      "complete",
    );
  });

  it("only returns work that genuinely needs attention", () => {
    const deals = [
      deal({ id: 1 }),
      deal({ id: 2, expected_closing_date: "2026-07-10" }),
      deal({ id: 3 }),
      deal({ id: 4, expected_closing_date: "2026-07-31" }),
      deal({ id: 5, stage: "on-hold" }),
    ];
    const tasks = buildOpenTasksByDeal([
      task({ deal_id: 1, due_date: "2026-07-20" }),
      task({ deal_id: 3, due_date: "2026-07-13" }),
      task({ deal_id: 4, due_date: "" }),
    ]);

    expect(
      rankDealsForAttention(deals, tasks, now).map(({ deal }) => deal.id),
    ).toEqual([3, 2, 4]);
  });

  it("summarizes the reasons that deals need attention", () => {
    const deals = [
      deal({ id: 1 }),
      deal({ id: 2, expected_closing_date: "2026-07-10" }),
      deal({ id: 3 }),
      deal({ id: 4, expected_closing_date: "2026-07-31" }),
    ];
    const tasks = buildOpenTasksByDeal([
      task({ deal_id: 1, due_date: "2026-07-13" }),
      task({ deal_id: 3, due_date: "2026-07-14" }),
      task({ deal_id: 4, due_date: "" }),
    ]);

    expect(
      summarizeDealAttention(rankDealsForAttention(deals, tasks, now)),
    ).toEqual({
      overdue: 1,
      planning: 1,
      today: 1,
      total: 4,
      unplanned: 1,
    });
  });
});
