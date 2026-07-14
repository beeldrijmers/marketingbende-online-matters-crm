import { describe, expect, it } from "vitest";

import { resolveTrelloListForDealStage } from "./trelloListMaps";

describe("resolveTrelloListForDealStage", () => {
  it.each([
    ["informatie-pipeline", "6979f9b306e4dba9dc5182fa"],
    ["on-hold", "6a40ed3ab091e5e140319312"],
    ["facturatie-live", "6979f9dd197030f0766dfaa5"],
    ["won", "6979f9a8a825b6ff46306ecf"],
  ])("maps CRM stage %s to its Trello workflow list", (stage, listId) => {
    expect(resolveTrelloListForDealStage({ stage, category: null })).toBe(
      listId,
    );
  });

  it.each([
    ["eenmalig", "6982ffae219bd60c27be88b5"],
    ["website-development", "69c0f7bd1a66e8c764d484ee"],
    ["website-optimalisatie", "69b56f4098ee1bc8c55e21ec"],
    ["happr", "6979f9a8a825b6ff46306ecd"],
  ])(
    "keeps active category %s in its dedicated Trello list",
    (category, listId) => {
      expect(resolveTrelloListForDealStage({ stage: "bezig", category })).toBe(
        listId,
      );
    },
  );

  it("uses generic Bezig for SEO and other work", () => {
    expect(
      resolveTrelloListForDealStage({ stage: "bezig", category: "seo" }),
    ).toBe("6979f9a8a825b6ff46306ece");
  });

  it("does not invent a Trello destination for an unsupported stage", () => {
    expect(
      resolveTrelloListForDealStage({ stage: "lost", category: null }),
    ).toBeNull();
  });
});
