import { INTERNAL_COMPANY_NAME } from "./trelloListMaps.ts";

// Strips the old "GO - " noise prefix and the board's standardized leading
// tags (e.g. [LEAD][SEO]), then takes the substring before the first remaining
// separator as the company name. Trello titles use a hyphen, en dash and em
// dash interchangeably, and the board also writes "Client: what is going on".
// Falls back to the cleaned title when no separator exists.
//
// The colon matters: without it every status-style card title became a company
// of its own, which is how the CRM ended up with a client called
// "ASP Noard: staging klaar, wacht op content en klantakkoord" next to the real
// ASP Noard. A hyphen inside a word ("Jack Pyke-import") is not a separator —
// only a spaced dash is — and a colon only separates when text follows it.
export const CARD_TITLE_SEPARATOR = /\s[-–—]\s|:\s/;

export const extractCompanyName = (cardName: string): string => {
  const withoutNoisePrefixes = cardName
    .replace(/^go\s*-\s*/i, "")
    .replace(/^(?:\s*\[[^\]]+\])+\s*/, "");
  const separator = CARD_TITLE_SEPARATOR.exec(withoutNoisePrefixes);
  return !separator
    ? withoutNoisePrefixes.trim()
    : withoutNoisePrefixes.slice(0, separator.index).trim();
};

// A card whose "company" is a month, a quarter or a year is a planning bucket,
// not a client ("Augustus 2026: bevestigd, klaar om in te plannen").
const PERIOD_NAME =
  /^(?:maand\s+)?(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|q[1-4]|kwartaal\s*[1-4])(?:\s+\d{4})?$|^\d{4}$/i;

export const isPeriodBucketName = (name: string): boolean =>
  PERIOD_NAME.test(name.trim());

// Hand-curated overrides for existing cards whose title doesn't follow the
// "Company - description" convention closely enough for extractCompanyName
// to produce an accurate result (e.g. no separator at all, the company name
// coming after the separator instead of before, or the "company" actually
// being an internal/reference item rather than a real client).
//
// This map only exists to maximize backfill accuracy for cards that already
// existed when the sync was built. New cards are expected to follow the
// naming convention above; extend this map only for genuine one-off outliers.
export const COMPANY_NAME_OVERRIDES: Record<string, string> = {
  "6a40fe9a036d93c20687fc4d": INTERNAL_COMPANY_NAME, // Soorten opdrachten / Diensten (naslag)
  "69afdf417185207d6303e885": INTERNAL_COMPANY_NAME, // n8n - AI agents (concurrentie scraper + blogger)
  "69da515cc4bc23bcb35ea202": INTERNAL_COMPANY_NAME, // Shiftbase tarieven (referentie)
  "69bbf0eb3a317bb8cbae860a": "Lightspeed", // Lightspeed POS koppeling
  "6a1fe27c15c0a3b7e5749c5c": INTERNAL_COMPANY_NAME, // MAAND JUNI
  "69bd46b0a98d96f6238bc6de": "Unitouch", // Unitouch koppeling
  "69d4229a5751eadcc0a3f4b9": INTERNAL_COMPANY_NAME, // V.O.F. overweging voor Happr
  "69a71bde32065874a0b347b1": "Google Reserve", // Google Reserve partner-aanvraag indienen
  "69ddf73eb318c57182beac8d": "Happr.nl", // Logo Happr.nl
  "6a43de9e1263dc26cb1686b6": INTERNAL_COMPANY_NAME, // image.png
  "69f44ec8d8709826133972ee": "MB Roofing", // Tips & tricks - MB Roofing: extra geld verdienen?
  "6a1e7b778ee03b5944126ee5": "Belco", // Eenmalige pagina - belco.nl
  "6a181fe4c707c67532e77849": "Hunting XL", // Scrape Hunting XL
  "6a195fbf2078912c7f1d695f": "Wierenga & de Graaf", // Voorstel Wierenga & de Graaf
  "6a084ac68a01af8a0157a414": "Autobedrijf vd Vegt", // Autobedrijf vd Vegt migreren
  "6a2b9774a857518553757cc5": "Grandcafe 't Stadhuys", // Stadshuys - benodigdheden Happr onboarding
};

export const resolveCompanyName = (card: {
  id: string;
  name: string;
}): string => {
  const override = COMPANY_NAME_OVERRIDES[card.id];
  if (override) return override;

  const extracted = extractCompanyName(card.name);
  return isPeriodBucketName(extracted) ? INTERNAL_COMPANY_NAME : extracted;
};
