import { describe, expect, it } from "vitest";

import type { Deal, DealStage } from "../types";
import { buildTrelloBoardSnapshot } from "./trelloBoardModel";

const stages: DealStage[] = [
  { value: "informatie-pipeline", label: "00 · Nog niet bevestigd" },
  { value: "bezig", label: "30 · Bezig" },
  { value: "won", label: "60 · Gefactureerd / afgerond" },
];

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 1,
  name: "Kaart",
  company_id: 1,
  contact_ids: [],
  category: "seo",
  stage: "informatie-pipeline",
  description: null,
  amount: null,
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
  expected_closing_date: "2026-07-31",
  trello_card_id: "trello-1",
  sales_id: 1,
  assignee_ids: [1],
  index: Number.NaN,
  ...overrides,
});

describe("buildTrelloBoardSnapshot", () => {
  it("mirrors only active Trello cards across the configured stage order", () => {
    const snapshot = buildTrelloBoardSnapshot(
      [
        deal(),
        deal({ id: 2, name: "Klaar", stage: "won" }),
        deal({ id: 3, trello_card_id: null }),
        deal({ id: 4, archived_at: "2026-07-20T10:00:00.000Z" }),
      ],
      stages,
    );

    expect(snapshot.columns.map(({ stage }) => stage.value)).toEqual([
      "informatie-pipeline",
      "bezig",
      "won",
    ]);
    expect(snapshot.columns.map(({ deals }) => deals.length)).toEqual([
      1, 0, 1,
    ]);
    expect(snapshot.total).toBe(2);
  });

  it("keeps unknown Trello stages visible as an explicit mismatch", () => {
    const snapshot = buildTrelloBoardSnapshot(
      [deal({ stage: "onbekend" })],
      stages,
    );

    expect(snapshot.total).toBe(0);
    expect(snapshot.unmapped.map(({ name }) => name)).toEqual(["Kaart"]);
  });

  it("uses position first and deadline/title as deterministic fallbacks", () => {
    const snapshot = buildTrelloBoardSnapshot(
      [
        deal({ id: 1, name: "Later", index: 2 }),
        deal({ id: 2, name: "Eerst", index: 1 }),
        deal({
          id: 3,
          name: "Zonder positie B",
          expected_closing_date: "2026-07-25",
        }),
        deal({
          id: 4,
          name: "Zonder positie A",
          expected_closing_date: "2026-07-24",
        }),
      ],
      stages,
    );

    expect(snapshot.columns[0].deals.map(({ id }) => id)).toEqual([2, 1, 4, 3]);
  });
});
