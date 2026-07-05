import { describe, it, expect } from "vitest";
import { verifySvixSignature } from "./verifySvixSignature";

// Sign like Svix does, so the test builds a genuinely valid header.
const sign = async (rawSecretB64: string, signed: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(rawSecretB64), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed),
  );
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

describe("verifySvixSignature", () => {
  const rawSecret = btoa("a-shared-webhook-secret-value!");
  const secret = `whsec_${rawSecret}`;
  const id = "msg_2abc";
  const timestamp = "1700000000";
  const payload = '{"type":"email.received","data":{"email_id":"x"}}';
  const nowSeconds = 1700000000;

  it("accepts a valid signature", async () => {
    const sig = await sign(rawSecret, `${id}.${timestamp}.${payload}`);
    await expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader: `v1,${sig}`,
        payload,
        nowSeconds,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const sig = await sign(rawSecret, `${id}.${timestamp}.${payload}`);
    await expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader: `v1,${sig}`,
        payload: '{"type":"email.received","data":{"email_id":"HACKED"}}',
        nowSeconds,
      }),
    ).resolves.toBe(false);
  });

  it("rejects a stale timestamp (replay)", async () => {
    const sig = await sign(rawSecret, `${id}.${timestamp}.${payload}`);
    await expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader: `v1,${sig}`,
        payload,
        nowSeconds: nowSeconds + 10_000,
      }),
    ).resolves.toBe(false);
  });

  it("accepts when one of several candidate signatures matches", async () => {
    const sig = await sign(rawSecret, `${id}.${timestamp}.${payload}`);
    await expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signatureHeader: `v1,not-the-right-signature v1,${sig}`,
        payload,
        nowSeconds,
      }),
    ).resolves.toBe(true);
  });

  it("rejects when headers are missing", async () => {
    await expect(
      verifySvixSignature({
        secret,
        id: "",
        timestamp,
        signatureHeader: "",
        payload,
        nowSeconds,
      }),
    ).resolves.toBe(false);
  });
});
