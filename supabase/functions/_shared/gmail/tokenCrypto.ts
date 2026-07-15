// AES-256-GCM storage for Gmail refresh tokens.
// The sales id is authenticated as AAD so ciphertext cannot be moved between
// connection rows. Plaintext tokens never leave edge-function memory.

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const encodeBase64 = (value: Uint8Array): string =>
  btoa(String.fromCharCode(...value));

const importKey = async (keyBase64: string): Promise<CryptoKey> => {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = decodeBase64(keyBase64);
  } catch {
    throw new Error("GMAIL_ENC_KEY is not valid base64");
  }
  if (bytes.length !== KEY_BYTES) {
    throw new Error(`GMAIL_ENC_KEY must decode to ${KEY_BYTES} bytes`);
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

export const gmailConnectionAad = (salesId: number | string): string =>
  `gmail_connection:${salesId}`;

export const encryptGmailToken = async (
  token: string,
  keyBase64: string,
  aad: string,
): Promise<string> => {
  if (!token) throw new Error("Cannot encrypt an empty Gmail token");
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    new TextEncoder().encode(token),
  );
  return [
    VERSION,
    encodeBase64(iv),
    encodeBase64(new Uint8Array(ciphertext)),
  ].join(":");
};

export const decryptGmailToken = async (
  encrypted: string,
  keyBase64: string,
  aad: string,
): Promise<string> => {
  const parts = encrypted.split(":");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error("Stored Gmail token has an unknown format");
  }
  const key = await importKey(keyBase64);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(parts[1]),
        additionalData: new TextEncoder().encode(aad),
      },
      key,
      decodeBase64(parts[2]),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Stored Gmail token could not be decrypted");
  }
};
