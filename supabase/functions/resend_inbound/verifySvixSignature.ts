// Verifies a Svix-signed webhook (Resend signs inbound webhooks with Svix),
// implemented with Web Crypto so the edge function needs no npm dependency.
//
// Scheme (https://docs.svix.com/receiving/verifying-payloads/how-manual):
//   signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
//   expected      = base64(HMAC-SHA256(key, signedContent))
//   key           = base64-decode(secret without its "whsec_" prefix)
// The `svix-signature` header holds space-separated "v1,<sig>" entries; a match
// against any one passes. A timestamp outside the tolerance window is rejected
// to limit replay attacks.

// Allocate the Uint8Array over a fresh ArrayBuffer so its type satisfies
// BufferSource (crypto.subtle rejects the ArrayBufferLike-backed variant that
// Uint8Array.from produces under newer TS lib types).
const base64ToBytes = (b64: string) => {
  const binary = atob(b64);
  // Inferred as Uint8Array<ArrayBuffer> (not ...<ArrayBufferLike>), which is
  // what crypto.subtle expects for a BufferSource.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

// Constant-time string comparison to avoid leaking the signature via timing.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export const verifySvixSignature = async ({
  secret,
  id,
  timestamp,
  signatureHeader,
  payload,
  toleranceSeconds = 60 * 5,
  nowSeconds = Date.now() / 1000,
}: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  payload: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): Promise<boolean> => {
  if (!secret || !id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(rawSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return false;
  }

  const signed = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, signed);
  const expected = bytesToBase64(new Uint8Array(signatureBuffer));

  // Header entries look like "v1,<base64sig>"; verify against each candidate.
  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((sig) => sig.length > 0 && timingSafeEqual(sig, expected));
};
