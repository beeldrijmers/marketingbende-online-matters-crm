import { describe, expect, it, vi } from "vitest";

import {
  trelloDueTimestamp,
  writeTrelloCardDueDate,
} from "./writeTrelloCardDueDate";

describe("writeTrelloCardDueDate", () => {
  it("writes a CRM date to Trello at the standard local work time", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      }),
    );

    await writeTrelloCardDueDate({
      cardId: "card-1",
      deadline: "2026-07-31",
      apiKey: "key",
      token: "token",
      fetchImpl,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(init).toEqual({ method: "PUT" });
    expect(url).toContain("/1/cards/card-1");
    expect(url).toContain(
      `due=${encodeURIComponent(trelloDueTimestamp("2026-07-31"))}`,
    );
  });

  it("surfaces a Trello failure", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      }),
    );

    await expect(
      writeTrelloCardDueDate({
        cardId: "card-1",
        deadline: "2026-07-31",
        apiKey: "key",
        token: "token",
        fetchImpl,
      }),
    ).rejects.toThrow(/429 rate limited/);
  });
});
