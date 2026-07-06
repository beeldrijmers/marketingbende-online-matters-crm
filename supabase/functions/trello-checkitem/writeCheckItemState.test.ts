import { describe, it, expect, vi } from "vitest";
import { writeCheckItemState } from "./writeCheckItemState";

const okFetch = () =>
  Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("") });

describe("writeCheckItemState", () => {
  it("PUTs the item with state=complete", async () => {
    const fetchImpl = vi.fn(okFetch);
    await writeCheckItemState({
      cardId: "card1",
      checkItemId: "ci1",
      complete: true,
      apiKey: "k",
      token: "t",
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(init).toEqual({ method: "PUT" });
    expect(url).toContain("https://api.trello.com/1/cards/card1/checkItem/ci1");
    expect(url).toContain("state=complete");
    expect(url).toContain("key=k");
    expect(url).toContain("token=t");
  });

  it("PUTs state=incomplete when reopening", async () => {
    const fetchImpl = vi.fn(okFetch);
    await writeCheckItemState({
      cardId: "c",
      checkItemId: "i",
      complete: false,
      apiKey: "k",
      token: "t",
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0][0]).toContain("state=incomplete");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      }),
    );
    await expect(
      writeCheckItemState({
        cardId: "c",
        checkItemId: "i",
        complete: true,
        apiKey: "k",
        token: "t",
        fetchImpl,
      }),
    ).rejects.toThrow(/404 not found/);
  });
});
