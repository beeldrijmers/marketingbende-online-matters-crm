import { describe, expect, it, vi } from "vitest";

import type { CrmDataProvider } from "../providers/types";
import type { Deal } from "../types";
import { writeLinkedDealStageToTrello } from "./trelloStageWriteback";

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 12,
    name: "Test project",
    company_id: 2,
    contact_ids: [],
    category: "website-development",
    stage: "informatie-pipeline",
    description: null,
    amount: 1000,
    created_at: "2026-07-14T10:00:00Z",
    updated_at: "2026-07-14T10:00:00Z",
    expected_closing_date: null,
    sales_id: 1,
    assignee_ids: [1],
    index: 0,
    ...overrides,
  }) as Deal;

const provider = () =>
  ({
    moveTrelloDealToStage: vi.fn(async () => {}),
  }) as unknown as Pick<CrmDataProvider, "moveTrelloDealToStage">;

describe("writeLinkedDealStageToTrello", () => {
  it("moves a linked Trello card for a cross-column CRM move", async () => {
    const dataProvider = provider();

    await writeLinkedDealStageToTrello(
      deal({ trello_card_id: "card-1" }),
      "bezig",
      dataProvider,
    );

    expect(dataProvider.moveTrelloDealToStage).toHaveBeenCalledWith(
      12,
      "bezig",
    );
  });

  it("does not call Trello for a CRM-only deal", async () => {
    const dataProvider = provider();

    await writeLinkedDealStageToTrello(deal(), "bezig", dataProvider);

    expect(dataProvider.moveTrelloDealToStage).not.toHaveBeenCalled();
  });

  it("does not call Trello when only reordering inside a column", async () => {
    const dataProvider = provider();

    await writeLinkedDealStageToTrello(
      deal({ trello_card_id: "card-1" }),
      "informatie-pipeline",
      dataProvider,
    );

    expect(dataProvider.moveTrelloDealToStage).not.toHaveBeenCalled();
  });
});
