// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
// Import WITHOUT the .ts extension (Vitest "functions" project convention).
import { fetchTrelloCardComments } from "./fetchTrelloCardComments";

const action = (id: number) => ({
  id: `a${id}`,
  date: `2026-01-${String(id).padStart(2, "0")}T00:00:00.000Z`,
  memberCreator: { fullName: "John" },
  data: { text: `comment ${id}` },
});

describe("fetchTrelloCardComments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the maximum page size instead of Trello's silent default of 50", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([action(2), action(1)]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const comments = await fetchTrelloCardComments({
      cardId: "c1",
      apiKey: "K",
      token: "T",
    });

    expect(comments.map((c) => c.text)).toEqual(["comment 1", "comment 2"]);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("limit")).toBe("1000");
  });

  it("pages backwards until a short page and returns chronological order", async () => {
    // Full first page (1000 items, newest first: 2000..1001), then a short one.
    const firstPage = Array.from({ length: 1000 }, (_, i) => action(2000 - i));
    const secondPage = [action(3), action(2), action(1)];
    const fetchMock = vi.fn((rawUrl: string) => {
      const url = new URL(rawUrl as string);
      return Promise.resolve(
        new Response(
          JSON.stringify(
            url.searchParams.has("before") ? secondPage : firstPage,
          ),
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const comments = await fetchTrelloCardComments({
      cardId: "c1",
      apiKey: "K",
      token: "T",
    });

    expect(comments).toHaveLength(1003);
    expect(comments[0].text).toBe("comment 1"); // oldest first
    expect(comments.at(-1)?.text).toBe("comment 2000");
    // The second request continues before the oldest action of page one.
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondUrl.searchParams.get("before")).toBe("a1001");
  });
});
