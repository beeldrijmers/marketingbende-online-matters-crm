// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkMailToActiveDeals } from "./linkMailToActiveDeals";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const contactQuery = (result: { data: unknown; error: unknown }) => ({
  select: () => ({
    contains: () => ({
      maybeSingle: () => Promise.resolve(result),
    }),
  }),
});

const dealsQuery = (result: { data: unknown; error: unknown }) => ({
  select: () => ({
    contains: () => ({
      is: () => Promise.resolve(result),
    }),
  }),
});

describe("linkMailToActiveDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mirrors the note to every active deal when the text matches none of them", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "contacts")
        return contactQuery({ data: { id: 7 }, error: null });
      if (table === "deals")
        return dealsQuery({
          data: [
            { id: 1, name: "Website onderhoud" },
            { id: 2, name: "Webshop bouwen" },
          ],
          error: null,
        });
      if (table === "deal_notes") return { insert };
      throw new Error(`unexpected table ${table}`);
    });

    const count = await linkMailToActiveDeals({
      contactEmail: "klant@acme.com",
      salesId: 42,
      noteContent: "Hallo",
      attachments: [],
    });

    expect(count).toBe(2);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledWith({
      deal_id: 1,
      text: "Hallo",
      sales_id: 42,
      attachments: [],
    });
  });

  it("mirrors the note ONLY to the deal named in the mail text", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "contacts")
        return contactQuery({ data: { id: 7 }, error: null });
      if (table === "deals")
        return dealsQuery({
          data: [
            { id: 1, name: "Website onderhoud" },
            { id: 2, name: "Webshop bouwen" },
          ],
          error: null,
        });
      if (table === "deal_notes") return { insert };
      throw new Error(`unexpected table ${table}`);
    });

    const noteContent = "Vraag over webshop bouwen\n\nWanneer gaan we live?";
    const count = await linkMailToActiveDeals({
      contactEmail: "klant@acme.com",
      salesId: 42,
      noteContent,
      attachments: [],
    });

    expect(count).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      deal_id: 2,
      text: noteContent,
      sales_id: 42,
      attachments: [],
    });
  });

  it("returns 0 when the contact does not exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "contacts")
        return contactQuery({ data: null, error: null });
      throw new Error(`should not query ${table}`);
    });

    const count = await linkMailToActiveDeals({
      contactEmail: "unknown@acme.com",
      salesId: 42,
      noteContent: "Hallo",
      attachments: [],
    });

    expect(count).toBe(0);
  });

  it("returns 0 when the contact has no active deals", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "contacts")
        return contactQuery({ data: { id: 7 }, error: null });
      if (table === "deals") return dealsQuery({ data: [], error: null });
      throw new Error(`should not query ${table}`);
    });

    const count = await linkMailToActiveDeals({
      contactEmail: "klant@acme.com",
      salesId: 42,
      noteContent: "Hallo",
      attachments: [],
    });

    expect(count).toBe(0);
  });
});
