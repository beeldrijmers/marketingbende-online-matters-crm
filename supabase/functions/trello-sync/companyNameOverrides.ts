import { INTERNAL_COMPANY_NAME } from "./trelloListMaps.ts";

// Strips a leading "GO - " noise prefix (case-insensitive), then takes the
// substring before the first remaining spaced dash as the company name. Trello
// titles in the wild use a hyphen, en dash and em dash interchangeably. Falls
// back to the whole (prefix-stripped) title when no separator exists.
//
// Examples:
//   "GO - Auto Siero - WhatsApp automation" -> "Auto Siero"
//   "MB Roofing - SEO"                      -> "MB Roofing"
//   "DJ Supply"                             -> "DJ Supply"
export const extractCompanyName = (cardName: string): string => {
  const withoutGoPrefix = cardName.replace(/^go\s*-\s*/i, "");
  const separator = /\s[-–—]\s/.exec(withoutGoPrefix);
  return !separator
    ? withoutGoPrefix.trim()
    : withoutGoPrefix.slice(0, separator.index).trim();
};

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
}): string => COMPANY_NAME_OVERRIDES[card.id] ?? extractCompanyName(card.name);
