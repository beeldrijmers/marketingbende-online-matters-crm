import { describe, expect, it } from "vitest";

import { IGNORED_LIST_IDS, shouldBackfillArchivedCard } from "./trelloListMaps";

const NASLAG = [...IGNORED_LIST_IDS][0];
const WERKLIJST = "6979f9a8a825b6ff46306e8b";

const kaart = (
  overrides: Partial<{ idList: string; uploads: number }> = {},
) => ({
  idList: overrides.idList ?? WERKLIJST,
  uploadedAttachments: Array.from({ length: overrides.uploads ?? 1 }),
});

describe("shouldBackfillArchivedCard", () => {
  it("verrijkt een gesloten werkkaart met bijlagen", () => {
    expect(shouldBackfillArchivedCard(kaart())).toBe(true);
  });

  it("slaat een kaart zonder bijlagen over", () => {
    expect(shouldBackfillArchivedCard(kaart({ uploads: 0 }))).toBe(false);
  });

  it("slaat naslag- en templatekaarten over", () => {
    // Dit is de regressie: deze fase filterde de negeerlijst niet, dus een
    // gesloten template met een schermafbeelding erop leverde een klant op.
    expect(shouldBackfillArchivedCard(kaart({ idList: NASLAG }))).toBe(false);
  });
});
