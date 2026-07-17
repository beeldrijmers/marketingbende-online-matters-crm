// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findOrCreateCompany } from "./findOrCreateCompany";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const lookup = (result: { data: unknown; error: unknown }) => ({
  select: () => ({
    eq: () => ({
      order: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    }),
  }),
});

describe("findOrCreateCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the concurrent winner when the Trello-name index rejects a duplicate", async () => {
    mockFrom
      .mockReturnValueOnce(lookup({ data: null, error: null }))
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key" },
              }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [{ id: 109, name: " bouwiva " }],
                error: null,
              }),
          }),
        }),
      });

    await expect(
      findOrCreateCompany({ name: "Bouwiva", salesId: 1 }),
    ).resolves.toBe(109);
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});
