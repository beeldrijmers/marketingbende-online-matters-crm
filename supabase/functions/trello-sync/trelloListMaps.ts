// List and label vocabulary of the "SEO - Online Matters" Trello board
// (board id 6979f9a8a825b6ff46306e8a), which in practice serves as
// Marketingbende's general internal project-tracking board, not just
// Online Matters-resold clients.

// Catch-all company for cards that don't represent a real client relationship
// (internal reference/roadmap cards, orphaned attachments, etc.).
export const INTERNAL_COMPANY_NAME = "Marketingbende (intern)";

// The "60 GEFACTUREERD / AFGEROND" list — a card moving here counts as the
// project being finished and triggers the team-lead notification.
export const WON_LIST_ID = "6982ffae219bd60c27be88b5";

// Trello is the source of truth for the operational workflow. Every real work
// list has a one-to-one CRM stage, so dragging a card in either system keeps
// the same left-to-right production line everywhere.
export const LIST_TO_STAGE: Record<string, string> = {
  "6979f9b306e4dba9dc5182fa": "informatie-pipeline", // 00 Nog niet bevestigd
  "69b56f4098ee1bc8c55e21ec": "bevestigd-inplannen", // 10 Bevestigd / inplannen
  "6a40ed3ab091e5e140319312": "on-hold", // 20 Wacht op input / geblokkeerd
  "6979f9a8a825b6ff46306ece": "bezig", // 30 Bezig
  "69c0f7bd1a66e8c764d484ee": "controle-livegang", // 40 Controle / akkoord / livegang
  "6979f9a8a825b6ff46306ecf": "facturatie-live", // 50 Klaar / te factureren
  "6982ffae219bd60c27be88b5": "won", // 60 Gefactureerd / afgerond
  "6979f9dd197030f0766dfaa5": "maandelijks", // 70 Maandelijks / vaste klanten
};

// "90 NASLAG / TEMPLATES" is useful board documentation, not client work.
// Existing linked deals are archived and new reference cards are skipped.
export const IGNORED_LIST_IDS = new Set(["6979f9a8a825b6ff46306ecd"]);

// Card labels encode the work category now that all lists encode workflow.
export const LABEL_TO_CATEGORY: Record<string, string> = {
  SEO: "seo",
  Eenmalig: "eenmalig",
  "Happr.nl": "happr",
};

export const DEFAULT_CATEGORY = "overig";

// Reverse mapping used when a CRM kanban move is written back to Trello.
export const STAGE_TO_LIST: Record<string, string> = {
  "informatie-pipeline": "6979f9b306e4dba9dc5182fa",
  "bevestigd-inplannen": "69b56f4098ee1bc8c55e21ec",
  "on-hold": "6a40ed3ab091e5e140319312",
  bezig: "6979f9a8a825b6ff46306ece",
  "controle-livegang": "69c0f7bd1a66e8c764d484ee",
  "facturatie-live": "6979f9a8a825b6ff46306ecf",
  won: WON_LIST_ID,
  maandelijks: "6979f9dd197030f0766dfaa5",
};

export const resolveTrelloListForDealStage = ({
  stage,
}: {
  stage: string;
  category: string | null;
}): string | null => STAGE_TO_LIST[stage] ?? null;

export const isIgnoredTrelloList = (listId: string): boolean =>
  IGNORED_LIST_IDS.has(listId);

// Whether a Trello list id is part of the known board vocabulary above. A
// list the team adds later is unknown here until the maps are updated; the
// sync then keeps its hands off the stage of existing deals instead of
// silently misclassifying every card in that list.
export const isKnownTrelloList = (listId: string): boolean =>
  listId in LIST_TO_STAGE || isIgnoredTrelloList(listId);
