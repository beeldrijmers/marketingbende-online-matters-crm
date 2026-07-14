import { describe, expect, it } from "vitest";

import { getTrelloSyncNotification } from "./trelloSyncNotification";

const summary = {
  cardCount: 46,
  synced: 46,
  totalComments: 12,
  totalAttachments: 2,
  archivedCardsWithUploads: 3,
  archivedAttachments: 1,
  failed: [],
};

describe("getTrelloSyncNotification", () => {
  it("reports a complete sync as processed rather than changed", () => {
    expect(getTrelloSyncNotification(summary)).toEqual({
      message: "resources.deals.trello_sync.success",
      type: "success",
      messageArgs: {
        smart_count: 46,
        _: "Trello gesynchroniseerd: 46 kaarten verwerkt.",
      },
    });
  });

  it("warns and names failed cards when a sync only partly succeeds", () => {
    expect(
      getTrelloSyncNotification({
        ...summary,
        synced: 44,
        failed: [
          { cardId: "1", cardName: "Klant A", error: "timeout" },
          { cardId: "2", cardName: "Klant B", error: "rate limited" },
        ],
      }),
    ).toEqual({
      message: "resources.deals.trello_sync.partial",
      type: "warning",
      messageArgs: {
        synced: 44,
        failed_count: 2,
        failed_names: "Klant A, Klant B",
        _: "Trello deels gesynchroniseerd: 44 actieve kaarten verwerkt. 2 mislukt (Klant A, Klant B).",
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
      getTrelloSyncNotification({ ...summary, synced: 41, failed }).messageArgs
        .failed_names,
    ).toBe("A, B, C +2");
  });
});
