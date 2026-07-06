// Pick which of a contact's active deals an inbound mail belongs to, based on
// the mail text (subject + body). PURE module: no Deno/Supabase imports, unit
// tested in Node via Vitest.
//
// Tiers, strictest first; every tier that yields at least one deal wins:
//   1. the deal's full (normalised) name appears in the mail
//   2. every significant token of the deal name appears in the mail
//   3. fallback: ALL active deals (the pre-existing behaviour), because
//      mirroring the mail too broadly is a smaller mistake than guessing one
//      wrong card and hiding the mail from the right one.
// With zero or one active deal there is nothing to choose.

export interface DealForMail {
  id: number;
  name: string | null;
}

// Common Dutch/English filler words that carry no meaning for matching a deal
// name ("Website voor de bakker" should match on "website" + "bakker").
const STOP_WORDS = new Set([
  "de",
  "het",
  "een",
  "en",
  "van",
  "voor",
  "met",
  "aan",
  "bij",
  "op",
  "in",
  "te",
  "the",
  "a",
  "an",
  "and",
  "for",
  "with",
  "of",
  "to",
]);

// Lowercase, strip diacritics, collapse everything non-alphanumeric to single
// spaces: "Wébshop, Hunting-XL!" -> "webshop hunting xl".
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const significantTokens = (name: string): string[] =>
  normalize(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

export const selectDealsForMail = (
  deals: DealForMail[],
  mailText: string,
): DealForMail[] => {
  if (deals.length <= 1) return deals;

  const text = ` ${normalize(mailText)} `;

  // Tier 1: the full deal name (with word boundaries) appears in the mail.
  // Very short names (< 4 chars) are excluded here; they fall through to the
  // token tier which applies the same length guard per token.
  const fullMatches = deals.filter((deal) => {
    const name = normalize(deal.name ?? "");
    return name.length >= 4 && text.includes(` ${name} `);
  });
  if (fullMatches.length > 0) return fullMatches;

  // Tier 2: every significant token of the deal name appears somewhere.
  const textTokens = new Set(text.split(" "));
  const tokenMatches = deals.filter((deal) => {
    const tokens = significantTokens(deal.name ?? "");
    return tokens.length > 0 && tokens.every((token) => textTokens.has(token));
  });
  if (tokenMatches.length > 0) return tokenMatches;

  return deals;
};
