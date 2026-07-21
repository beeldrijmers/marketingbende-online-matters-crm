import { describe, expect, it } from "vitest";

import type { Deal } from "../types";
import { getChangedTrelloDeadline } from "./trelloDeadlineWriteback";

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Opdracht",
    company_id: 1,
    contact_ids: [],
    category: "seo",
    stage: "bezig",
    description: null,
    amount: 300,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-21T00:00:00Z",
    expected_closing_date: "2026-07-31",
    sales_id: 1,
    index: 0,
    trello_card_id: "card-1",
    ...overrides,
  }) as Deal;

describe("getChangedTrelloDeadline", () => {
  it("returns a changed deadline for a linked Trello deal", () => {
    expect(
      getChangedTrelloDeadline({
        data: { expected_closing_date: "2026-07-25" },
        previousData: deal(),
      }),
    ).toBe("2026-07-25");
  });

  it("ignores partial stage/index updates and unchanged dates", () => {
    expect(
      getChangedTrelloDeadline({
        data: { stage: "controle-livegang", index: 2 },
        previousData: deal(),
      }),
    ).toBeNull();
    expect(
      getChangedTrelloDeadline({
        data: { expected_closing_date: "2026-07-31" },
        previousData: deal(),
      }),
    ).toBeNull();
  });

  it("does not write deadlines for deals without a Trello card", () => {
    expect(
      getChangedTrelloDeadline({
        data: { expected_closing_date: "2026-07-25" },
        previousData: deal({ trello_card_id: null }),
      }),
    ).toBeNull();
  });
});
