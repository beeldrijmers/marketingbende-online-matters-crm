import { describe, expect, it } from "vitest";
import {
  decryptGmailToken,
  encryptGmailToken,
  gmailConnectionAad,
} from "./tokenCrypto";

const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

describe("Gmail token encryption", () => {
  it("round-trips with the connection AAD", async () => {
    const encrypted = await encryptGmailToken(
      "refresh-token",
      key,
      gmailConnectionAad(12),
    );

    expect(encrypted).not.toContain("refresh-token");
    await expect(
      decryptGmailToken(encrypted, key, gmailConnectionAad(12)),
    ).resolves.toBe("refresh-token");
  });

  it("rejects a token copied to another sales row", async () => {
    const encrypted = await encryptGmailToken(
      "refresh-token",
      key,
      gmailConnectionAad(12),
    );

    await expect(
      decryptGmailToken(encrypted, key, gmailConnectionAad(13)),
    ).rejects.toThrow("could not be decrypted");
  });
});
