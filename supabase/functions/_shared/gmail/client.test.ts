import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listGmailHistoryMessageIds,
  listGmailLabels,
  searchGmailMessageIds,
} from "./client.ts";

const fetchResponse = (body: unknown) =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gmail API selection", () => {
  it("watches both newly-added mail and CRM labels applied later", async () => {
    const fetch = vi.fn().mockResolvedValue(
      fetchResponse({
        history: [
          {
            messagesAdded: [{ message: { id: "new-mail" } }],
            labelsAdded: [{ message: { id: "labelled-later" } }],
          },
        ],
        historyId: "next-history",
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      listGmailHistoryMessageIds("token", "before", "Label_CRM"),
    ).resolves.toEqual({
      ids: ["new-mail", "labelled-later"],
      historyId: "next-history",
    });

    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get("labelId")).toBe("Label_CRM");
    expect(url.searchParams.getAll("historyTypes")).toEqual([
      "messageAdded",
      "labelAdded",
    ]);
  });

  it("returns Gmail label metadata without reading a mail body", async () => {
    const fetch = vi.fn().mockResolvedValue(
      fetchResponse({
        labels: [{ id: "Label_CRM", name: "CRM", type: "user" }],
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(listGmailLabels("token")).resolves.toEqual([
      { id: "Label_CRM", name: "CRM", type: "user" },
    ]);
    expect(String(fetch.mock.calls[0][0])).toContain("/labels");
  });

  it("searches sent-mail context with pagination and a strict result cap", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        fetchResponse({
          messages: [{ id: "one" }, { id: "two" }],
          nextPageToken: "next",
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          messages: [{ id: "two" }, { id: "three" }, { id: "four" }],
        }),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(
      searchGmailMessageIds(
        "token",
        'in:sent {"Voorbeeldbedrijf" "voorbeeld.nl"}',
        3,
      ),
    ).resolves.toEqual(["one", "two", "three"]);

    const firstUrl = new URL(String(fetch.mock.calls[0][0]));
    const secondUrl = new URL(String(fetch.mock.calls[1][0]));
    expect(firstUrl.searchParams.get("q")).toBe(
      'in:sent {"Voorbeeldbedrijf" "voorbeeld.nl"}',
    );
    expect(secondUrl.searchParams.get("pageToken")).toBe("next");
  });
});
