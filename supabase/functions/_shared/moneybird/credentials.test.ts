// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions"
// project (the Deno source imports use .ts).
import { resolveMoneybirdCredentials } from "./credentials";
import { connectionAad, encryptToken } from "./tokenCrypto";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)),
);
const OTHER_KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 255 - i)),
);
const TOKEN = "mb_personal_token_abcdef1234567890";

const connectionQuery = (result: { data: unknown; error: unknown }) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve(result),
    }),
  }),
});

describe("resolveMoneybirdCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns decrypted credentials for a connected user", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(7));
    mockFrom.mockImplementation((table: string) => {
      if (table === "moneybird_connections")
        return connectionQuery({
          data: {
            administration_id: "478715071487280295",
            api_token_encrypted: encrypted,
          },
          error: null,
        });
      throw new Error(`unexpected table ${table}`);
    });

    const credentials = await resolveMoneybirdCredentials(7, KEY);
    expect(credentials).toEqual({
      apiToken: TOKEN,
      administrationId: "478715071487280295",
    });
  });

  it("returns null when the user has no connection", async () => {
    mockFrom.mockImplementation(() =>
      connectionQuery({ data: null, error: null }),
    );
    expect(await resolveMoneybirdCredentials(7, KEY)).toBeNull();
  });

  it("throws on a database error", async () => {
    mockFrom.mockImplementation(() =>
      connectionQuery({ data: null, error: { message: "boom" } }),
    );
    await expect(resolveMoneybirdCredentials(7, KEY)).rejects.toThrow(
      "Could not load the Moneybird connection for sales 7: boom",
    );
  });

  it("throws (does not return null) when the row cannot be decrypted", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(7));
    mockFrom.mockImplementation(() =>
      connectionQuery({
        data: {
          administration_id: "478715071487280295",
          api_token_encrypted: encrypted,
        },
        error: null,
      }),
    );
    // Wrong key (e.g. rotated MONEYBIRD_ENC_KEY) must surface as an error, not
    // as "not connected".
    await expect(resolveMoneybirdCredentials(7, OTHER_KEY)).rejects.toThrow(
      "could not be decrypted",
    );
  });

  it("throws when a ciphertext was copied from another user's row", async () => {
    // Encrypted for sales 8, stored on sales 7's row: AAD mismatch.
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(8));
    mockFrom.mockImplementation(() =>
      connectionQuery({
        data: {
          administration_id: "478715071487280295",
          api_token_encrypted: encrypted,
        },
        error: null,
      }),
    );
    await expect(resolveMoneybirdCredentials(7, KEY)).rejects.toThrow(
      "could not be decrypted",
    );
  });
});
