import { describe, expect, it } from "vitest";

import {
  formatTrelloSyncDuration,
  getTrelloSyncNotification,
} from "./trelloSyncNotification";

const summary = {
  cardCount: 46,
  synced: 42,
  ignored: 4,
  totalComments: 12,
  totalAttachments: 2,
  archivedCardsWithUploads: 3,
  archivedAttachments: 1,
  durationMs: 18_400,
  stageCounts: {
    "informatie-pipeline": 5,
    "bevestigd-inplannen": 4,
    "on-hold": 2,
    bezig: 9,
    "controle-livegang": 3,
    "facturatie-live": 6,
    won: 8,
    maandelijks: 5,
  },
  failed: [],
};

describe("getTrelloSyncNotification", () => {
  it("reports a complete sync as processed rather than changed", () => {
    expect(getTrelloSyncNotification(summary)).toEqual({
      message: "resources.deals.trello_sync.success",
      type: "success",
      messageArgs: {
        smart_count: 42,
        duration: "18 sec",
        stage_summary:
          "Niet bevestigd 5 · Bevestigd 4 · Wacht 2 · Bezig 9 · Controle 3 · Factureren 6 · Afgerond 8 · Maandelijks 5",
        _:
          "Trello gesynchroniseerd: 42 kaarten in 18 sec. " +
          "Niet bevestigd 5 · Bevestigd 4 · Wacht 2 · Bezig 9 · Controle 3 · Factureren 6 · Afgerond 8 · Maandelijks 5",
      },
    });
  });

  it("warns and names failed cards when a sync only partly succeeds", () => {
    expect(
      getTrelloSyncNotification({
        ...summary,
        synced: 40,
        failed: [
          { cardId: "1", cardName: "Klant A", error: "timeout" },
          { cardId: "2", cardName: "Klant B", error: "rate limited" },
        ],
      }),
    ).toEqual({
      message: "resources.deals.trello_sync.partial",
      type: "warning",
      messageArgs: {
        synced: 40,
        failed_count: 2,
        failed_names: "Klant A, Klant B",
        duration: "18 sec",
        stage_summary:
          "Niet bevestigd 5 · Bevestigd 4 · Wacht 2 · Bezig 9 · Controle 3 · Factureren 6 · Afgerond 8 · Maandelijks 5",
        _:
          "Trello deels gesynchroniseerd in 18 sec: 40 actieve kaarten verwerkt. " +
          "2 mislukt (Klant A, Klant B). Niet bevestigd 5 · Bevestigd 4 · " +
          "Wacht 2 · Bezig 9 · Controle 3 · Factureren 6 · Afgerond 8 · Maandelijks 5",
      },
    });
  });

  it("keeps long failure lists readable", () => {
    const failed = ["A", "B", "C", "D", "E"].map((cardName) => ({
      cardId: cardName,
      cardName,
      error: "failed",
    }));

    expect(
      getTrelloSyncNotification({ ...summary, synced: 37, failed }).messageArgs
        .failed_names,
    ).toBe("A, B, C +2");
  });
});

describe("formatTrelloSyncDuration", () => {
  it("shows seconds while a normal sync completes", () => {
    expect(formatTrelloSyncDuration(400)).toBe("1 sec");
    expect(formatTrelloSyncDuration(18_400)).toBe("18 sec");
  });

  it("keeps a longer sync readable", () => {
    expect(formatTrelloSyncDuration(60_000)).toBe("1 min");
    expect(formatTrelloSyncDuration(92_000)).toBe("1 min 32 sec");
  });
});
