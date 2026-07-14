export type ParsedActivityNote = {
  body: string;
  isAttachment: boolean;
  source: "trello" | null;
  sourceAuthor: string | null;
};

const TRELLO_PREFIX = /^\[Trello\s*-\s*([^\]]+)\]\s*/i;
const TRELLO_ATTACHMENT_MARKER = /\[trello-bijlage:[^\]]+\]/gi;

/**
 * Turns the transport-oriented text stored by the Trello sync into content
 * that can be presented as a note. The source prefix becomes metadata and the
 * internal idempotency marker for imported attachments is never shown to a
 * user. Markdown and intentional line breaks in the actual comment stay intact.
 */
export const parseActivityNote = (text: string): ParsedActivityNote => {
  const prefix = text.match(TRELLO_PREFIX);
  const rawAuthor = prefix?.[1]?.trim() ?? null;
  const isTrello = prefix != null;
  const isAttachment = rawAuthor?.toLocaleLowerCase() === "bijlage";
  const withoutPrefix = prefix ? text.slice(prefix[0].length) : text;
  const body = withoutPrefix
    .replace(TRELLO_ATTACHMENT_MARKER, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    body,
    isAttachment,
    source: isTrello ? "trello" : null,
    sourceAuthor: isTrello && !isAttachment ? rawAuthor : null,
  };
};
