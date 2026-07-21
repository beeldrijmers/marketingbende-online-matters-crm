import { describe, expect, it } from "vitest";

import { resolveTrelloListForDealStage } from "./trelloListMaps";

describe("resolveTrelloListForDealStage", () => {
  it.each([
    ["informatie-pipeline", "6979f9b306e4dba9dc5182fa"],
    ["bevestigd-inplannen", "69b56f4098ee1bc8c55e21ec"],
    ["on-hold", "6a40ed3ab091e5e140319312"],
    ["bezig", "6979f9a8a825b6ff46306ece"],
    ["controle-livegang", "69c0f7bd1a66e8c764d484ee"],
    ["facturatie-live", "6979f9a8a825b6ff46306ecf"],
    ["won", "6982ffae219bd60c27be88b5"],
    ["maandelijks", "6979f9dd197030f0766dfaa5"],
  ])("maps CRM stage %s to its Trello workflow list", (stage, listId) => {
    expect(resolveTrelloListForDealStage({ stage, category: null })).toBe(
      listId,
    );
  });

  it("does not let a category change the workflow destination", () => {
    expect(
      resolveTrelloListForDealStage({
        stage: "bezig",
        category: "website-development",
      }),
    ).toBe("6979f9a8a825b6ff46306ece");
  });

  it("does not invent a Trello destination for an unsupported stage", () => {
    expect(
      resolveTrelloListForDealStage({ stage: "lost", category: null }),
    ).toBeNull();
  });
});
