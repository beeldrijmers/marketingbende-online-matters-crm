// Best-effort web lookup of a company's website from its name, used only when
// the Trello card itself carries no website. Uses Clearbit's keyless company
// autocomplete (name -> domain). The resolved website feeds the company_saved
// trigger, which derives the logo/favicon automatically.
//
// To avoid giving a company the WRONG logo, we accept a suggestion only when the
// domain's second-level label matches the (normalized) company name exactly.
// This means unknown small companies simply get no logo (same as before) rather
// than a confidently-wrong one. Any network/parse failure returns null.

interface ClearbitSuggestion {
  name: string;
  domain: string;
  logo: string;
}

// Generic legal/segment words that appear in a company name but rarely in its
// domain; dropped before matching so "Acme BV" still matches "acme.nl".
const GENERIC_TOKENS = new Set([
  "bv",
  "nv",
  "vof",
  "holding",
  "group",
  "llc",
  "inc",
  "ltd",
  "gmbh",
]);

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !GENERIC_TOKENS.has(token))
    .join("");

const domainLabel = (domain: string): string =>
  (domain.split(".")[0] || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const lookupCompanyWebsite = async (
  companyName: string,
): Promise<string | null> => {
  const target = normalizeName(companyName);
  if (!target) return null;

  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`,
    );
    if (!response.ok) return null;

    const suggestions = (await response.json()) as ClearbitSuggestion[];
    for (const suggestion of suggestions) {
      if (!suggestion.domain) continue;
      if (domainLabel(suggestion.domain) === target) {
        return `https://${suggestion.domain.toLowerCase()}`;
      }
    }
    return null;
  } catch (error) {
    console.error(
      `Clearbit website lookup failed for "${companyName}" (best-effort):`,
      error,
    );
    return null;
  }
};
