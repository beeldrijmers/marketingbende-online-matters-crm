import { describe, expect, it, vi } from "vitest";

import { endOfWorkMonth, ensureTrelloCardDeadline } from "./deadline";
import type { TrelloCardInput } from "./trelloCardTypes";

const card = (overrides: Partial<TrelloCardInput> = {}): TrelloCardInput => ({
  id: "card-1",
  name: "Opdracht",
  idList: "list-1",
  labelNames: [],
  start: null,
  due: null,
  dueComplete: false,
  closed: false,
  url: "https://trello.com/c/card-1",
  desc: "",
  attachmentUrls: [],
  uploadedAttachments: [],
  members: [],
  checkItems: [],
  checklistsPresent: true,
  ...overrides,
});

describe("endOfWorkMonth", () => {
  it("uses the final calendar day in the Amsterdam timezone", () => {
    expect(endOfWorkMonth(new Date("2026-07-21T10:00:00Z"))).toBe("2026-07-31");
    // 23:30Z is already March in Amsterdam.
    expect(endOfWorkMonth(new Date("2026-02-28T23:30:00Z"))).toBe("2026-03-31");
  });
});

describe("ensureTrelloCardDeadline", () => {
  it("preserves a deliberate Trello deadline", async () => {
    const writeDeadline = vi.fn();
    const existing = card({ due: "2026-07-24T07:00:00.000Z" });
    await expect(
      ensureTrelloCardDeadline({
        card: existing,
        apiKey: "key",
        token: "token",
        writeDeadline,
      }),
    ).resolves.toBe(existing);
    expect(writeDeadline).not.toHaveBeenCalled();
  });

  it("writes and returns the month-end fallback when the date is missing", async () => {
    const writeDeadline = vi.fn(async () => undefined);
    const result = await ensureTrelloCardDeadline({
      card: card(),
      apiKey: "key",
      token: "token",
      now: new Date("2026-07-21T10:00:00Z"),
      writeDeadline,
    });

    expect(writeDeadline).toHaveBeenCalledWith({
      cardId: "card-1",
      deadline: "2026-07-31",
      apiKey: "key",
      token: "token",
    });
    expect(result.due).toBe("2026-07-31T15:00:00.000Z");
  });
});
