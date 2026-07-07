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

// The 5 genuine stage lists map directly to a stage. The 4 category lists
// have no stage information in their list membership, so a card there
// defaults to "facturatie-live" unless it's marked done (either via the
// "Afgerond" label or Trello's own due-complete checkbox), in which case
// it's "won".
export const resolveStage = (
  listId: string,
  labels: string[],
  dueComplete: boolean,
): string => {
  const stageFromList = LIST_TO_STAGE[listId];
  if (stageFromList) return stageFromList;

  return labels.includes("Afgerond") || dueComplete ? "won" : "facturatie-live";
};

// The deal name is the full card title with only the "GO - " noise prefix
// stripped, so the CRM keeps the full Trello context instead of collapsing
// it down to the company name (which already gets its own record).
export const resolveDealName = (cardName: string): string =>
  cardName.replace(/^go\s*-\s*/i, "").trim();

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
