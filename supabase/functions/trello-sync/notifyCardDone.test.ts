import { describe, it, expect } from "vitest";
import { buildCardDoneEmail, isMoveToWonList } from "./notifyCardDone";

const WON = "6979f9a8a825b6ff46306ecf";
const OTHER = "6979f9dd197030f0766dfaa5";

describe("isMoveToWonList", () => {
  it("is true when a card moves into Klaar from another list", () => {
    expect(
      isMoveToWonList(
        {
          type: "updateCard",
          data: { listBefore: { id: OTHER }, listAfter: { id: WON } },
        },
        WON,
      ),
    ).toBe(true);
  });

  it("is false when the card is edited while already in Klaar", () => {
    expect(
      isMoveToWonList(
        {
          type: "updateCard",
          data: { listBefore: { id: WON }, listAfter: { id: WON } },
        },
        WON,
      ),
    ).toBe(false);
  });

  it("is false for a non-list edit (no listAfter)", () => {
    expect(
      isMoveToWonList(
        { type: "updateCard", data: { listBefore: { id: OTHER } } },
        WON,
      ),
    ).toBe(false);
  });

  it("is false when moving to a different list", () => {
    expect(
      isMoveToWonList(
        {
          type: "updateCard",
          data: { listBefore: { id: WON }, listAfter: { id: OTHER } },
        },
        WON,
      ),
    ).toBe(false);
  });

  it("is false for other action types", () => {
    expect(
      isMoveToWonList(
        {
          type: "commentCard",
          data: { listAfter: { id: WON }, listBefore: { id: OTHER } },
        },
        WON,
      ),
    ).toBe(false);
  });
});

describe("buildCardDoneEmail", () => {
  it("names the project, the person and the date", () => {
    const { subject, text } = buildCardDoneEmail({
      projectName: "Borg Hekwerk - SEO",
      doneBy: "John Plantenga",
      date: "5 juli 2026",
    });
    expect(subject).toBe("Afgerond: Borg Hekwerk - SEO");
    expect(text).toContain("John Plantenga");
    expect(text).toContain("Borg Hekwerk - SEO");
    expect(text).toContain("5 juli 2026");
  });

  it("includes the card link when provided", () => {
    const { text } = buildCardDoneEmail({
      projectName: "X",
      doneBy: "Rick",
      cardUrl: "https://trello.com/c/abc",
      date: "5 juli 2026",
    });
    expect(text).toContain("https://trello.com/c/abc");
  });
});
