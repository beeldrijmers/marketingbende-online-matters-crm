import { describe, expect, it, vi } from "vitest";

import { writeTrelloCardList } from "./writeTrelloCardList";

describe("writeTrelloCardList", () => {
  it("moves the card with Trello's PUT idList request", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      }),
    );
    await writeTrelloCardList({
      cardId: "card-1",
      listId: "list-2",
      apiKey: "key",
      token: "token",
      fetchImpl,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(init).toEqual({ method: "PUT" });
    expect(url).toContain("/1/cards/card-1");
    expect(url).toContain("idList=list-2");
    expect(url).toContain("key=key");
    expect(url).toContain("token=token");
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
      writeTrelloCardList({
        cardId: "card-1",
        listId: "list-2",
        apiKey: "key",
        token: "token",
        fetchImpl,
      }),
    ).rejects.toThrow(/429 rate limited/);
  });
});
