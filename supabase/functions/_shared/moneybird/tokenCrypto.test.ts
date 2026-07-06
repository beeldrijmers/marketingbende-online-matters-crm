// @vitest-environment node
import { describe, it, expect } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions"
// project to resolve the module under test (the Deno source imports use .ts).
import { connectionAad, decryptToken, encryptToken } from "./tokenCrypto";

// A fixed 32-byte key, base64 encoded (deterministic for the tests; real keys
// come from the MONEYBIRD_ENC_KEY secret).
const KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)),
);
const OTHER_KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 255 - i)),
);

const TOKEN = "mb_personal_token_abcdef1234567890";

describe("connectionAad", () => {
  it("binds the AAD to the sales id", () => {
    expect(connectionAad(7)).toBe("moneybird_connection:7");
    expect(connectionAad("7")).toBe("moneybird_connection:7");
  });
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a token", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(1));
    const decrypted = await decryptToken(encrypted, KEY, connectionAad(1));
    expect(decrypted).toBe(TOKEN);
  });

  it("produces the v1 three-part format without leaking the plaintext", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(1));
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");
    expect(encrypted).not.toContain(TOKEN);
  });

  it("uses a fresh IV per encryption (identical input, different ciphertext)", async () => {
    const first = await encryptToken(TOKEN, KEY, connectionAad(1));
    const second = await encryptToken(TOKEN, KEY, connectionAad(1));
    expect(first).not.toBe(second);
  });

  it("rejects decryption with the wrong key", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(1));
    await expect(
      decryptToken(encrypted, OTHER_KEY, connectionAad(1)),
    ).rejects.toThrow("could not be decrypted");
  });

  it("rejects a ciphertext moved to another row (AAD mismatch)", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(1));
    await expect(
      decryptToken(encrypted, KEY, connectionAad(2)),
    ).rejects.toThrow("could not be decrypted");
  });

  it("rejects a tampered ciphertext", async () => {
    const encrypted = await encryptToken(TOKEN, KEY, connectionAad(1));
    const [version, iv, ciphertext] = encrypted.split(":");
    const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    bytes[0] = bytes[0] ^ 0xff; // flip bits in the first byte
    const tampered = [version, iv, btoa(String.fromCharCode(...bytes))].join(
      ":",
    );
    await expect(decryptToken(tampered, KEY, connectionAad(1))).rejects.toThrow(
      "could not be decrypted",
    );
  });

  it("rejects an unknown storage format", async () => {
    await expect(decryptToken("v2:a:b", KEY, connectionAad(1))).rejects.toThrow(
      "unknown format",
    );
    await expect(
      decryptToken("plaintext-token", KEY, connectionAad(1)),
    ).rejects.toThrow("unknown format");
  });

  it("rejects keys of the wrong length", async () => {
    const shortKey = btoa("too-short");
    await expect(
      encryptToken(TOKEN, shortKey, connectionAad(1)),
    ).rejects.toThrow("must decode to 32 bytes");
  });

  it("rejects a key that is not valid base64", async () => {
    await expect(
      encryptToken(TOKEN, "not base64!!!", connectionAad(1)),
    ).rejects.toThrow("not valid base64");
  });

  it("rejects encrypting an empty token", async () => {
    await expect(encryptToken("", KEY, connectionAad(1))).rejects.toThrow(
      "empty token",
    );
  });
});
