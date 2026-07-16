import { describe, expect, it, vi } from "vitest";

import type { Deal } from "../types";
import {
  type DealBoardDataProvider,
  persistDealStageMove,
  updateDealStageLocal,
} from "./dealStageMove";

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    amount: 1000,
    category: "website-development",
    company_id: 1,
    contact_ids: [],
    created_at: "2026-07-15T10:00:00Z",
    description: null,
    expected_closing_date: null,
    id: 1,
    index: 0,
    name: "Pipeline deal",
    sales_id: 1,
    stage: "informatie-pipeline",
    updated_at: "2026-07-15T10:00:00Z",
    ...overrides,
  }) as Deal;

describe("deal stage moves", () => {
  it("moves a deal locally without mutating either source column", () => {
    const source = deal();
    const original = {
      "informatie-pipeline": [source],
      bezig: [deal({ id: 2, index: 0, name: "Bestaand", stage: "bezig" })],
    };

    const result = updateDealStageLocal(
      source,
      { stage: "informatie-pipeline", index: 0 },
      { stage: "bezig", index: 1 },
      original,
    );

    expect(original["informatie-pipeline"]).toEqual([source]);
    expect(original.bezig).toHaveLength(1);
    expect(result["informatie-pipeline"]).toEqual([]);
    expect(result.bezig.map(({ id }) => id)).toEqual([2, 1]);
    expect(result.bezig[1]?.stage).toBe("bezig");
  });

  it("persists a quick cross-stage move at the end of its destination", async () => {
    const source = deal({ trello_card_id: "trello-1" });
    const destinationDeal = deal({ id: 2, index: 0, stage: "bezig" });
    const update = vi.fn(async (_resource, params) => ({ data: params.data }));
    const dataProvider = {
      getList: vi.fn(async (_resource, params) => ({
        data:
          params.filter.stage === "informatie-pipeline"
            ? [source]
            : [destinationDeal],
        total: 1,
      })),
      moveTrelloDealToStage: vi.fn(async () => undefined),
      update,
    } as unknown as DealBoardDataProvider;

    await persistDealStageMove(
      source,
      { stage: "bezig", index: undefined },
      dataProvider,
    );

    expect(dataProvider.moveTrelloDealToStage).toHaveBeenCalledWith(1, "bezig");
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({
        id: 1,
        data: { index: 2, stage: "bezig" },
      }),
    );
  });

  it("reindexes intervening deals when moving down within a stage", async () => {
    const source = deal({ index: 0 });
    const second = deal({ id: 2, index: 1 });
    const third = deal({ id: 3, index: 2 });
    const update = vi.fn(async (_resource, params) => ({ data: params.data }));
    const dataProvider = {
      getList: vi.fn(async () => ({
        data: [source, second, third],
        total: 3,
      })),
      update,
    } as unknown as DealBoardDataProvider;

    await persistDealStageMove(
      source,
      { stage: source.stage, index: 2 },
      dataProvider,
    );

    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({ id: 2, data: { index: 0 } }),
    );
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({ id: 3, data: { index: 1 } }),
    );
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({ id: 1, data: { index: 2 } }),
    );
  });

  it("reindexes both columns when inserting into a specific position", async () => {
    const source = deal({ index: 0 });
    const sourceFollower = deal({ id: 2, index: 1 });
    const destinationDeal = deal({ id: 3, index: 0, stage: "bezig" });
    const update = vi.fn(async (_resource, params) => ({ data: params.data }));
    const dataProvider = {
      getList: vi.fn(async (_resource, params) => ({
        data:
          params.filter.stage === "informatie-pipeline"
            ? [source, sourceFollower]
            : [destinationDeal],
        total: 2,
      })),
      update,
    } as unknown as DealBoardDataProvider;

    await persistDealStageMove(
      source,
      { stage: "bezig", index: 0 },
      dataProvider,
    );

    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({ id: 2, data: { index: 0 } }),
    );
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({ id: 3, data: { index: 1 } }),
    );
    expect(update).toHaveBeenCalledWith(
      "deals",
      expect.objectContaining({
        id: 1,
        data: { index: 0, stage: "bezig" },
      }),
    );
  });
});
