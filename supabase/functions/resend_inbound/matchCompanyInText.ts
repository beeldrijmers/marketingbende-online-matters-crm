// Matches an existing company by name mentioned in free-form mail text (the
// subject/body). This is what lets a forward like "Aanpassingen HuntingXL
// 06-07-2026" be recognised as the existing customer HuntingXL, instead of
// creating a company from the sender's e-mail domain. Only used as a fallback,
// when the mail carries no external client e-mail address of its own.

export interface CompanyForMatch {
  id: number;
  name: string;
}

// Lowercase and strip everything except letters/digits, so "Hunting XL",
// "HuntingXL" and "hunting-xl" all normalise to the same "huntingxl".
export const normalizeCompanyName = (value: string): string =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Names shorter than this after normalisation are too generic to match on
// safely (e.g. a 2-3 letter company name would hit half the dictionary).
const MIN_MATCH_LENGTH = 4;

// Finds the existing company whose (normalised) name occurs in the (normalised)
// text. Prefers the LONGEST matching name so a specific "huntingxl" wins over a
// short generic one that happens to be a substring. Returns null when nothing
// matches confidently.
export const findCompanyMentionedInText = (
  text: string,
  companies: CompanyForMatch[],
): CompanyForMatch | null => {
  const haystack = normalizeCompanyName(text);
  if (!haystack) return null;

  let best: CompanyForMatch | null = null;
  let bestLength = 0;
  for (const company of companies) {
    const needle = normalizeCompanyName(company.name);
    if (needle.length < MIN_MATCH_LENGTH) continue;
    if (needle.length > bestLength && haystack.includes(needle)) {
      best = company;
      bestLength = needle.length;
    }
  }
  return best;
};
