import { describe, expect, it } from "vitest";
import { gmailInboundEmailId, selectGmailSyncBatch } from "./batch.ts";

describe("selectGmailSyncBatch", () => {
  it("skips claimed messages and limits the next batch", () => {
    const result = selectGmailSyncBatch({
      messageIds: ["a", "b", "c", "d", "e"],
      claimedEmailIds: new Set([
        gmailInboundEmailId(7, "a"),
        gmailInboundEmailId(7, "c"),
      ]),
      salesId: 7,
      limit: 2,
    });

    expect(result).toEqual({
      messageIds: ["b", "d"],
      alreadyHandled: 2,
      remaining: 1,
    });
  });

  it("does not treat another mailbox owner's claim as handled", () => {
    const result = selectGmailSyncBatch({
      messageIds: ["same-message"],
      claimedEmailIds: new Set([gmailInboundEmailId(8, "same-message")]),
      salesId: 7,
      limit: 10,
    });

    expect(result).toEqual({
      messageIds: ["same-message"],
      alreadyHandled: 0,
      remaining: 0,
    });
  });

  it("uses at least one item for an invalid batch limit", () => {
    const result = selectGmailSyncBatch({
      messageIds: ["a", "b"],
      claimedEmailIds: new Set(),
      salesId: 7,
      limit: 0,
    });

    expect(result.messageIds).toEqual(["a"]);
    expect(result.remaining).toBe(1);
  });
});
