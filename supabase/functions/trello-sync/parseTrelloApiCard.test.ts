import { describe, it, expect } from "vitest";
import { parseTrelloApiCard, type TrelloApiCard } from "./parseTrelloApiCard";

const base: TrelloApiCard = {
  id: "card1",
  name: "Stadshuys - onboarding",
  idList: "list1",
  due: null,
  dueComplete: false,
  shortUrl: "https://trello.com/c/abc",
  desc: "beschrijving",
};

describe("parseTrelloApiCard", () => {
  it("flattens checklist items across all checklists into steps", () => {
    const card = parseTrelloApiCard({
      ...base,
      checklists: [
        {
          id: "cl1",
          name: "Aan te leveren",
          checkItems: [
            {
              id: "ci1",
              name: "Logo",
              state: "complete",
              due: null,
              idMember: null,
            },
            {
              id: "ci2",
              name: "Kleuren",
              state: "incomplete",
              due: "2026-07-10T00:00:00.000Z",
              idMember: "m1",
            },
          ],
        },
        {
          id: "cl2",
          name: "Techniek",
          checkItems: [
            { id: "ci3", name: "Tracking", state: "incomplete", due: null, idMember: null },
          ],
        },
      ],
    });
    expect(card.checkItems).toEqual([
      { id: "ci1", name: "Logo", complete: true, memberId: null, due: null },
      {
        id: "ci2",
        name: "Kleuren",
        complete: false,
        memberId: "m1",
        due: "2026-07-10T00:00:00.000Z",
      },
      { id: "ci3", name: "Tracking", complete: false, memberId: null, due: null },
    ]);
  });

  it("maps card members and tolerates missing optional collections", () => {
    const card = parseTrelloApiCard({
      ...base,
      members: [{ id: "m1", fullName: "Rick Maarssen" }],
    });
    expect(card.members).toEqual([{ id: "m1", fullName: "Rick Maarssen" }]);
    expect(card.checkItems).toEqual([]);
    expect(card.labelNames).toEqual([]);
    expect(card.attachmentUrls).toEqual([]);
  });
});
