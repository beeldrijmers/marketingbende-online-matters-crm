import {
  LIST_TO_STAGE,
  CATEGORY_LIST_TO_CATEGORY,
  LABEL_TO_CATEGORY,
  DEFAULT_CATEGORY,
} from "./trelloListMaps.ts";

export type CategoryResolutionSource = "list" | "label" | "text" | "default";

export interface CategoryResolution {
  category: string;
  source: CategoryResolutionSource;
}

// Lists and labels are authoritative. When both are absent, only explicit,
// fixed wording may classify free text; broad semantic guessing is forbidden.
// This lets title/description/comments enrich a card without any AI or
// hindsight-based one-off rules.
export const resolveCategoryWithSource = (
  listId: string,
  labels: string[],
  text = "",
): CategoryResolution => {
  const categoryFromList = CATEGORY_LIST_TO_CATEGORY[listId];
  if (categoryFromList) {
    return { category: categoryFromList, source: "list" };
  }

  for (const label of labels) {
    const categoryFromLabel = LABEL_TO_CATEGORY[label];
    if (categoryFromLabel) {
      return { category: categoryFromLabel, source: "label" };
    }
  }

  if (
    /\b(?:pakket|dienst|opdracht|categorie|type)\s*[:=-]\s*seo\b/i.test(text) ||
    /\bseo[- ]?(?:pakket|abonnement|retainer)\b/i.test(text)
  ) {
    return { category: "seo", source: "text" };
  }
  if (
    /\b(?:website|webshop)\s+(?:ontwikkelen|ontwikkeling|bouwen)\b/i.test(text)
  ) {
    return { category: "website-development", source: "text" };
  }
  if (
    /\bwebsite\s+(?:optimalisatie|optimaliseren|aanpassingen)\b/i.test(text)
  ) {
    return { category: "website-optimalisatie", source: "text" };
  }
  if (/\beenmalig(?:e)?\s+(?:project|pagina|klus|opdracht)\b/i.test(text)) {
    return { category: "eenmalig", source: "text" };
  }
  if (
    /\bhappr(?:\.nl)?\b[^\n]{0,80}\b(?:onboarding|koppeling|inrichten)\b/i.test(
      text,
    )
  ) {
    return { category: "happr", source: "text" };
  }

  return { category: DEFAULT_CATEGORY, source: "default" };
};

export const resolveCategory = (
  listId: string,
  labels: string[],
  text = "",
): string => resolveCategoryWithSource(listId, labels, text).category;

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
  revenuePeriod: string | null = null,
): string => {
  const stageFromList = LIST_TO_STAGE[listId];
  if (stageFromList) {
    // A monthly service in "Facturatie + live" is already running. Showing it
    // as a one-way delivery phase makes recurring work look finished instead
    // of active, so keep it in Bezig. A move to Klaar still resolves to won;
    // the database cycle trigger records the completed month and returns the
    // deal to Bezig in one atomic update.
    if (
      stageFromList === "facturatie-live" &&
      revenuePeriod === "maandelijks"
    ) {
      return "bezig";
    }
    return stageFromList;
  }

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

export type RevenuePeriod = "maandelijks" | "eenmalig";

const periodFromText = (text: string): RevenuePeriod | null => {
  const monthly =
    /per\s*maand|p\s*\/\s*m|\/\s*mnd|\bmnd\b|maandelijks|terugkerend|abonnement|retainer/i.test(
      text,
    );
  const oneOff = /\beenmalig(?:e)?\b|one[- ]?off/i.test(text);

  // Conflicting prose is not a license to guess. A list or label can still
  // decide below, but otherwise the CRM leaves the field unclassified.
  if (monthly === oneOff) return null;
  return monthly ? "maandelijks" : "eenmalig";
};

// Whether a deal's fee recurs monthly or is a one-off. Explicit categories
// are authoritative. Otherwise fixed wording is checked source-by-source in
// the order supplied by the caller (normally newest comments, title, then
// description) so old contradictory prose never wins by accident.
export const resolveRevenuePeriod = (
  category: string,
  text: string | string[] = "",
): RevenuePeriod | null => {
  if (category === "seo") return "maandelijks";
  if (
    category === "eenmalig" ||
    category === "website-development" ||
    category === "website-optimalisatie"
  ) {
    return "eenmalig";
  }
  if (category !== DEFAULT_CATEGORY) return null;

  for (const sourceText of Array.isArray(text) ? text : [text]) {
    const period = periodFromText(sourceText);
    if (period) return period;
  }
  return null;
};
