import type { TrelloCardInput, TrelloCommentInput } from "./trelloCardTypes.ts";

export const trelloCommentTexts = (
  comments: TrelloCommentInput[] | undefined,
): string[] => (comments ?? []).map((comment) => comment.text).filter(Boolean);

// One deterministic text corpus for fields that are safe to infer from text.
// Source ordering is deliberate: the title identifies the project, the
// description is the maintained brief, and comments are chronological updates.
export const trelloSourceText = (card: TrelloCardInput): string =>
  [card.name, card.desc, ...trelloCommentTexts(card.comments)]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
