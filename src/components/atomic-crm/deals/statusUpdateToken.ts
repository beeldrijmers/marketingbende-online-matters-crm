/**
 * The share token, generated in the browser of the person sharing.
 *
 * Same alphabet and length as the edge function validates and the database
 * constrains: lowercase base32 without the characters that get misread when a
 * link is retyped from a printed page (o/0, i/l/1). 32 characters over a
 * 31-character alphabet is ~158 bits — a link nobody guesses.
 */
export const STATUS_TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const STATUS_TOKEN_LENGTH = 32;

export const createStatusToken = (): string => {
  const bytes = new Uint8Array(STATUS_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  // Rejection-free mapping is not needed here: the tiny modulo bias over a
  // 31-symbol alphabet costs a fraction of a bit against ~158.
  return Array.from(
    bytes,
    (byte) => STATUS_TOKEN_ALPHABET[byte % STATUS_TOKEN_ALPHABET.length],
  ).join("");
};

/** The link a client opens. Hash routing, so it survives static hosting. */
export const statusUpdateUrl = (token: string): string =>
  `${window.location.origin}${window.location.pathname}#/status/${token}`;
