// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findOrCreateCompany } from "./findOrCreateCompany";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// The lookup matches case-insensitively (ilike), so one client written two ways
// on two cards resolves to a single company.
const lookup = (result: { data: unknown; error: unknown }) => ({
  select: () => ({
    ilike: (_column: string, pattern: string) => {
      lookupPatterns.push(pattern);
      return {
        order: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve(result),
          }),
        }),
      };
    },
  }),
});

const lookupPatterns: string[] = [];

describe("findOrCreateCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupPatterns.length = 0;
  });

  it("finds a client written in a different case instead of duplicating it", async () => {
    mockFrom.mockReturnValueOnce(
      lookup({
        data: { id: 27, website: "https://huntingxl.nl" },
        error: null,
      }),
    );

    await expect(
      findOrCreateCompany({ name: "hunting xl", salesId: 1 }),
    ).resolves.toBe(27);
    expect(lookupPatterns).toEqual(["hunting xl"]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("escapes wildcards so a name cannot match a different client", async () => {
    mockFrom
      .mockReturnValueOnce(lookup({ data: null, error: null }))
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 5 }, error: null }),
          }),
        }),
      });

    await findOrCreateCompany({ name: "100% Groen_BV", salesId: 1 });
    expect(lookupPatterns).toEqual(["100\\% Groen\\_BV"]);
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
