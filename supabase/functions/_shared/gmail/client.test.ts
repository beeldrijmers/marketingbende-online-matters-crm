import { afterEach, describe, expect, it, vi } from "vitest";

import { listGmailHistoryMessageIds, listGmailLabels } from "./client.ts";

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
});
