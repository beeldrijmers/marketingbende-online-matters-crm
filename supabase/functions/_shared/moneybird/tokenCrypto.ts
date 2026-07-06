// AES-256-GCM encryption for per-user Moneybird API tokens at rest.
//
// PURE module by design (same convention as payload.ts / verifySvixSignature):
// no Deno/Supabase imports and the key is a function PARAMETER, never read from
// the environment here, so the module is unit-testable in Node via Vitest and a
// missing secret surfaces as a clear per-request error in the handler instead
// of an import-time crash.
//
// Stored format: "v1:<base64 iv>:<base64 ciphertext+tag>". The GCM tag is the
// authenticity check; the caller binds the ciphertext to its database row by
// passing the owning sales id as additional authenticated data (AAD), so a
// ciphertext copied onto another user's row fails to decrypt.

const VERSION_PREFIX = "v1";
const IV_BYTES = 12; // NIST-recommended GCM nonce size
const KEY_BYTES = 32; // AES-256

// Allocate over a fresh ArrayBuffer: crypto.subtle rejects the
// ArrayBufferLike-backed variant that Uint8Array.from produces under newer TS
// lib types (same workaround as verifySvixSignature.ts).
const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

// The AAD for a connection row. Kept in one place so encrypt and decrypt can
// never drift apart.
export const connectionAad = (salesId: number | string): string =>
  `moneybird_connection:${salesId}`;

const importAesKey = async (keyBase64: string): Promise<CryptoKey> => {
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = base64ToBytes(keyBase64);
  } catch {
    throw new Error("MONEYBIRD_ENC_KEY is not valid base64");
  }
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error(
      `MONEYBIRD_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${keyBytes.length}`,
    );
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

export const encryptToken = async (
  plaintext: string,
  keyBase64: string,
  aad: string,
): Promise<string> => {
  if (!plaintext) {
    throw new Error("Cannot encrypt an empty token");
  }
  const key = await importAesKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    new TextEncoder().encode(plaintext),
  );
  return [
    VERSION_PREFIX,
    bytesToBase64(iv),
    bytesToBase64(new Uint8Array(ciphertext)),
  ].join(":");
};

export const decryptToken = async (
  encoded: string,
  keyBase64: string,
  aad: string,
): Promise<string> => {
  const parts = encoded.split(":");
  if (parts.length !== 3 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Stored Moneybird token has an unknown format");
  }
  const key = await importAesKey(keyBase64);
  let iv: Uint8Array<ArrayBuffer>;
  let ciphertext: Uint8Array<ArrayBuffer>;
  try {
    iv = base64ToBytes(parts[1]);
    ciphertext = base64ToBytes(parts[2]);
  } catch {
    throw new Error("Stored Moneybird token is not valid base64");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(aad),
      },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // A GCM auth failure means a wrong key, a tampered ciphertext, or a
    // ciphertext moved to another row (AAD mismatch). Never include details.
    throw new Error("Stored Moneybird token could not be decrypted");
  }
};
