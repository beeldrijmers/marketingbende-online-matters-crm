import {
  LIST_TO_STAGE,
  CATEGORY_LIST_TO_CATEGORY,
  LABEL_TO_CATEGORY,
  DEFAULT_CATEGORY,
} from "./trelloListMaps.ts";

// Deal category is derived purely from Trello signals (list or label), never
// from card-title text, so it stays reproducible for future cards where the
// sync can't rely on hindsight/domain knowledge the way the historical
// backfill can for company names.
export const resolveCategory = (listId: string, labels: string[]): string => {
  const categoryFromList = CATEGORY_LIST_TO_CATEGORY[listId];
  if (categoryFromList) return categoryFromList;

  for (const label of labels) {
    const categoryFromLabel = LABEL_TO_CATEGORY[label];
    if (categoryFromLabel) return categoryFromLabel;
  }

  return DEFAULT_CATEGORY;
};

// The 5 genuine stage lists map directly to a stage. The 4 project/category
// lists represent active production work, so they belong in "Bezig" unless
// marked done. Only the actual "Facturatie + live project" list maps to the
// later facturatie-live phase. An entirely unknown list starts conservatively
// in "Nieuw"; existing deals in unknown lists keep their CRM stage in the
// upsert layer until the list map is updated.
export const resolveStage = (
  listId: string,
  labels: string[],
  dueComplete: boolean,
): string => {
  const stageFromList = LIST_TO_STAGE[listId];
  if (stageFromList) return stageFromList;

  if (labels.includes("Afgerond") || dueComplete) return "won";
  if (listId in CATEGORY_LIST_TO_CATEGORY) return "bezig";
  return "informatie-pipeline";
};

// The deal name is the full card title with only the "GO - " noise prefix
// stripped, so the CRM keeps the full Trello context instead of collapsing
// it down to the company name (which already gets its own record).
export const resolveDealName = (cardName: string): string =>
  cardName.replace(/^go\s*-\s*/i, "").trim();

// Internal (non-billable own work) vs external client work, mirroring the
// classification rule of migration 20260707020000_add_deal_is_internal: Happr
// product work, the Lightspeed POS integration and Marketingbende/Online
// Matters' own projects are internal. Only applied on deal creation; a manual
// toggle in the CRM always wins afterwards.
export const resolveIsInternal = ({
  category,
  dealName,
  companyName,
}: {
  category: string;
  dealName: string;
  companyName: string;
}): boolean =>
  category === "happr" ||
  /lightspeed/i.test(dealName) ||
  /^(marketingbende|online matters)/i.test(companyName.trim());

// Whether a deal's fee recurs monthly or is a one-off, derived from its
// category: SEO is a monthly subscription, project categories are one-off.
// Anything else (Happr, overig) is left unclassified (null) so it doesn't
// count as either kind of revenue. Only set on creation and when a category
// maps cleanly; a manual edit in the CRM always wins.
export const resolveRevenuePeriod = (
  category: string,
): "maandelijks" | "eenmalig" | null => {
  if (category === "seo") return "maandelijks";
  if (
    category === "eenmalig" ||
    category === "website-development" ||
    category === "website-optimalisatie"
  ) {
    return "eenmalig";
  }
  return null;
};
