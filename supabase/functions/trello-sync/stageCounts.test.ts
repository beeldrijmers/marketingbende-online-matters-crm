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
        { stage: "bezig" },
        { stage: "bezig" },
        { stage: "on-hold" },
        { stage: "facturatie-live" },
        { stage: "won" },
      ]),
    ).toEqual({
      "informatie-pipeline": 1,
      bezig: 2,
      "on-hold": 1,
      "facturatie-live": 1,
      won: 1,
    });
  });

  it("ignores unknown legacy stages", () => {
    expect(
      countTrelloSyncStages([{ stage: "legacy" }, { stage: null }]),
    ).toEqual(emptyTrelloSyncStageCounts());
  });
});
