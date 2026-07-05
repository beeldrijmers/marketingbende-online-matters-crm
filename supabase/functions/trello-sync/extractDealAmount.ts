// Pure helper: pull the deal value (in whole euros) out of a Trello card's name
// and description. Marketing-agency cards quote the price consistently, e.g.
//   "EUR 300 excl. BTW per maand", "EUR 250 excl. btw p/m", "vanaf EUR 750",
//   "EUR 2.250", "€2500,-", "eenmalig €4000,-", "(eenmalig 750 excl. btw)".
//
// Dutch number format: "." is the thousands separator and "," the decimal, so
// "2.250" = 2250 and "1.500,50" = 1500.50. The result is rounded to whole euros
// (the deals.amount column is an integer). Returns null when no price is found.

// Parses a Dutch-formatted amount string ("2.250", "300", "2500,", "1.500,50").
const parseDutchAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // Drop thousands separators, then turn the decimal comma into a dot.
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
};

// A digit run that may contain Dutch thousands/decimal separators.
const NUMBER = "[0-9][0-9.,]*";
// "EUR 300", "€2.250", "€ 2500,-"
const CURRENCY_RE = new RegExp(`(?:€|\\bEUR\\b)\\s?(${NUMBER})`, "i");
// "750 excl. btw", "150 p/m", "300 per maand" (number directly before the unit)
const SUFFIX_RE = new RegExp(
  `(${NUMBER})\\s?(?:excl\\.?\\s?btw|incl\\.?\\s?btw|p\\/m|per maand)`,
  "i",
);

const findFirstAmount = (text: string): number | null => {
  const currency = text.match(CURRENCY_RE);
  if (currency) {
    const amount = parseDutchAmount(currency[1]);
    if (amount != null) return amount;
  }
  const suffix = text.match(SUFFIX_RE);
  if (suffix) {
    const amount = parseDutchAmount(suffix[1]);
    if (amount != null) return amount;
  }
  return null;
};

export const extractDealAmount = (
  name: string,
  desc: string,
): number | null => {
  // The card name usually carries the agreed price (e.g. "(eenmalig 750 excl.
  // btw)"), so it takes precedence over the (often multi-price) description.
  return findFirstAmount(name ?? "") ?? findFirstAmount(desc ?? "");
};
