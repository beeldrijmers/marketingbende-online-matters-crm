/**
 * The shape of a share token.
 *
 * The frontend generates it from crypto.getRandomValues over this alphabet; the
 * database constrains its length; this validates it before a request is allowed
 * to reach the database at all, so a probe like `?token=' or 1=1` costs nothing.
 *
 * Lowercase base32 without vowels-that-confuse: no O/0 or I/l mix-ups when a
 * link is read out loud or retyped from a printed page.
 */
export const STATUS_TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const STATUS_TOKEN_LENGTH = 32;

const TOKEN_PATTERN = new RegExp(
  `^[${STATUS_TOKEN_ALPHABET}]{${STATUS_TOKEN_LENGTH}}$`,
);

export const isValidStatusToken = (token: string): boolean =>
  TOKEN_PATTERN.test(token);
