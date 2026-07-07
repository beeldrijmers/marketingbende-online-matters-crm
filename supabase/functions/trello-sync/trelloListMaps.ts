// List and label vocabulary of the "SEO - Online Matters" Trello board
// (board id 6979f9a8a825b6ff46306e8a), which in practice serves as
// Marketingbende's general internal project-tracking board, not just
// Online Matters-resold clients.

// Catch-all company for cards that don't represent a real client relationship
// (internal reference/roadmap cards, orphaned attachments, etc.).
export const INTERNAL_COMPANY_NAME = "Marketingbende (intern)";

// The "Klaar" list — a card moving here counts as the project being finished
// and triggers the team-lead notification.
export const WON_LIST_ID = "6979f9a8a825b6ff46306ecf";

// Lists whose name directly maps to a deal stage. The "On Hold" list maps to
// the "on-hold" stage ("In de wacht" column); a trigger then sets deals.on_hold
// from that stage.
export const LIST_TO_STAGE: Record<string, string> = {
  "6979f9b306e4dba9dc5182fa": "informatie-pipeline", // informatie + pipeline
  "6979f9a8a825b6ff46306ece": "bezig", // Bezig
  "6a40ed3ab091e5e140319312": "on-hold", // On Hold
  "6979f9dd197030f0766dfaa5": "facturatie-live", // Facturatie + live project
  "6979f9a8a825b6ff46306ecf": "won", // Klaar
};

// Lists whose name actually encodes a deal category rather than a stage.
// Their stage is resolved separately (see resolveDealFields.ts).
export const CATEGORY_LIST_TO_CATEGORY: Record<string, string> = {
  "6982ffae219bd60c27be88b5": "eenmalig", // Eenmalige projecten
  "69c0f7bd1a66e8c764d484ee": "website-development", // WEBSITE DEVELOPMENT
  "69b56f4098ee1bc8c55e21ec": "website-optimalisatie", // Website optimalisaties
  "6979f9a8a825b6ff46306ecd": "happr", // Happr.nl - restaurant tool
};

// Card labels that encode a deal category, for cards living in one of the
// five genuine stage lists above.
export const LABEL_TO_CATEGORY: Record<string, string> = {
  SEO: "seo",
  Eenmalig: "eenmalig",
  "Happr.nl": "happr",
};

export const DEFAULT_CATEGORY = "overig";
