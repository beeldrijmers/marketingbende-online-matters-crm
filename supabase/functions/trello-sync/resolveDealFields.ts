import {
  LIST_TO_STAGE,
  LABEL_TO_CATEGORY,
  DEFAULT_CATEGORY,
} from "./trelloListMaps.ts";

export type CategoryResolutionSource = "title" | "label" | "text" | "default";

export interface CategoryResolution {
  category: string;
  source: CategoryResolutionSource;
}

// Workflow lists no longer encode a category. A standardized bracket prefix
// in the card title is the strongest signal, followed by Trello labels. When
// both are absent, only explicit fixed wording may classify free text; broad
// semantic guessing is deliberately avoided.
export const resolveCategoryWithSource = (
  _listId: string,
  labels: string[],
  text = "",
): CategoryResolution => {
  const title = text.split(/\r?\n/, 1)[0] ?? "";
  const titleTags = [...title.matchAll(/\[([^\]]+)\]/g)].map((match) =>
    match[1].trim(),
  );
  if (titleTags.some((tag) => /\bHAPPR(?:\.NL)?\b/i.test(tag))) {
    return { category: "happr", source: "title" };
  }
  if (titleTags.some((tag) => /WEBSITE[- ]?OPTIMALISATIE/i.test(tag))) {
    return { category: "website-optimalisatie", source: "title" };
  }
  if (
    titleTags.some((tag) => /\b(?:WEBSITE|WEBSHOP|LANDINGSPAGINA)\b/i.test(tag))
  ) {
    return { category: "website-development", source: "title" };
  }
  if (titleTags.some((tag) => /\bSEO\b/i.test(tag))) {
    return { category: "seo", source: "title" };
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

// Every operational list maps directly to a stage. An entirely unknown list
// starts conservatively in "Nog niet bevestigd"; existing deals in unknown
// lists keep their CRM stage in the upsert layer until the map is updated.
export const resolveStage = (
  listId: string,
  labels: string[],
  dueComplete: boolean,
): string => {
  const stageFromList = LIST_TO_STAGE[listId];
  if (stageFromList) return stageFromList;

  if (labels.includes("Afgerond") || dueComplete) return "won";
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
