// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addTrelloCommentAsDealNote } from "./addTrelloCommentAsDealNote";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("./resolveDefaultSalesId.ts", () => ({
  resolveDefaultSalesId: () => Promise.resolve(1),
}));

describe("addTrelloCommentAsDealNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats a retried Trello action as already synchronized", async () => {
    const insert = vi.fn(() =>
      Promise.resolve({
        error: { code: "23505", message: "duplicate key" },
      }),
    );
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 118 }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ insert });

    await expect(
      addTrelloCommentAsDealNote({
        trelloCardId: "card-1",
        authorName: "John",
        commentText: "Afgerond",
        sourceEventId: "trello:action-1",
      }),
    ).resolves.toBe(118);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source_event_id: "trello:action-1" }),
    );
  });
});
