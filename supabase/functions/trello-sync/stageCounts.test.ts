import { describe, expect, it } from "vitest";

import {
  countTrelloSyncStages,
  emptyTrelloSyncStageCounts,
} from "./stageCounts";

describe("countTrelloSyncStages", () => {
  it("summarizes where active Trello deals ended up in the CRM", () => {
    expect(
      countTrelloSyncStages([
        { stage: "informatie-pipeline" },
        { stage: "bevestigd-inplannen" },
        { stage: "on-hold" },
        { stage: "bezig" },
        { stage: "bezig" },
        { stage: "controle-livegang" },
        { stage: "facturatie-live" },
        { stage: "won" },
        { stage: "maandelijks" },
      ]),
    ).toEqual({
      "informatie-pipeline": 1,
      "bevestigd-inplannen": 1,
      "on-hold": 1,
      bezig: 2,
      "controle-livegang": 1,
      "facturatie-live": 1,
      won: 1,
      maandelijks: 1,
    });
  });

  it("ignores unknown legacy stages", () => {
    expect(
      countTrelloSyncStages([{ stage: "legacy" }, { stage: null }]),
    ).toEqual(emptyTrelloSyncStageCounts());
  });
});
