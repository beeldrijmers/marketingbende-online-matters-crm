import { describe, it, expect } from "vitest";
import { parseTrelloApiCard, type TrelloApiCard } from "./parseTrelloApiCard";

const base: TrelloApiCard = {
  id: "card1",
  name: "Stadshuys - onboarding",
  idList: "list1",
  start: null,
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
            {
              id: "ci3",
              name: "Tracking",
              state: "incomplete",
              due: null,
              idMember: null,
            },
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
      {
        id: "ci3",
        name: "Tracking",
        complete: false,
        memberId: null,
        due: null,
      },
    ]);
    expect(card.checklistsPresent).toBe(true);
  });

  it("reports checklistsPresent=false when the response has no checklists field", () => {
    const card = parseTrelloApiCard({ ...base });
    expect(card.checklistsPresent).toBe(false);
    expect(card.checkItems).toEqual([]);
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

describe("closed (archived) cards", () => {
  it("carries the closed flag through", () => {
    expect(parseTrelloApiCard({ ...base, closed: true }).closed).toBe(true);
  });

  it("defaults closed to false when the field is missing", () => {
    expect(parseTrelloApiCard(base).closed).toBe(false);
  });
});

describe("project dates", () => {
  it("carries Trello start and due dates through to the sync input", () => {
    const card = parseTrelloApiCard({
      ...base,
      start: "2026-07-01T00:00:00.000Z",
      due: "2026-07-31T00:00:00.000Z",
    });
    expect(card.start).toBe("2026-07-01T00:00:00.000Z");
    expect(card.due).toBe("2026-07-31T00:00:00.000Z");
  });

  it("defaults a missing Trello start date to null", () => {
    const { start: _start, ...withoutStart } = base;
    expect(parseTrelloApiCard(withoutStart).start).toBeNull();
  });
});
