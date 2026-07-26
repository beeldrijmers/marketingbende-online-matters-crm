// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

import { findContactByEmail } from "./findContactByEmail";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin.ts", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

/** Legt vast met welke keten er gezocht is, want de ordening is de hele clou. */
const contactsTable = (rows: unknown[] | null, error: unknown = null) => {
  const calls: { columns?: string; orderArgs?: unknown[]; limit?: number } = {};
  mockFrom.mockReturnValue({
    select: (columns: string) => {
      calls.columns = columns;
      return {
        contains: () => ({
          order: (...orderArgs: unknown[]) => {
            calls.orderArgs = orderArgs;
            return {
              limit: (limit: number) => {
                calls.limit = limit;
                return Promise.resolve({ data: rows, error });
              },
            };
          },
        }),
      };
    },
  });
  return calls;
};

describe("findContactByEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pakt de oudste rij als twee contacten hetzelfde adres hebben", async () => {
    // Met maybeSingle() was dit een 406, en in het Gmail-pad verdween de mail
    // dan stil: de claim werd niet vrijgegeven en de cursor schoof toch door.
    const calls = contactsTable([{ id: 7 }]);

    const { contact, error } = await findContactByEmail("info@klant.nl");

    expect(contact).toEqual({ id: 7 });
    expect(error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("contacts");
    expect(calls.orderArgs).toEqual(["id", { ascending: true }]);
    expect(calls.limit).toBe(1);
  });

  it("geeft null als er geen contact is, zonder fout", async () => {
    contactsTable([]);
    await expect(findContactByEmail("onbekend@klant.nl")).resolves.toEqual({
      contact: null,
      error: null,
    });
  });

  it("geeft de leesfout terug in plaats van te gooien", async () => {
    // De aanroepers gaan hier verschillend mee om: de een throwt, de ander slaat
    // de mail over. Die keuze hoort bij hen te blijven.
    contactsTable(null, { message: "DB error" });

    const { contact, error } = await findContactByEmail("info@klant.nl");

    expect(contact).toBeNull();
    expect(error).toEqual({ message: "DB error" });
  });

  it("vraagt alleen de gevraagde kolommen op", async () => {
    const calls = contactsTable([{ id: 3, company_id: 9 }]);
    await findContactByEmail("info@klant.nl", "id, company_id");
    expect(calls.columns).toBe("id, company_id");
  });
});
