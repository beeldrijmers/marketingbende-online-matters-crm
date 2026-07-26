/**
 * Markdown reduced to the words.
 *
 * Trello card descriptions and forwarded mail arrive as markdown, and the CRM
 * printed the syntax along with the text: "## Nieuwe lead", "**Telefoon:**".
 * Where a surface renders markdown (the description panel, a note) that is fine;
 * where it does not — a card snippet, a client-facing status update, a mail
 * subject — the syntax has to go, not be shown.
 *
 * Deliberately small and lossy: it strips markers and keeps the sentence. No
 * HTML, no rendering, so it is safe to put in plain text anywhere.
 */
export const stripMarkdown = (value: string | null | undefined): string => {
  if (!value) return "";
  return (
    value
      // Fenced and inline code: keep the content, drop the fences.
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/`([^`]+)`/g, "$1")
      // Images before links, so the alt text does not survive as a stray word.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // Headings, blockquotes and list markers at the start of a line. The
      // leading indent is matched with [ \t] and never \s: \s also matches a
      // newline, and a greedy match then swallowed the blank line before a list,
      // gluing a paragraph onto the bullets that followed it.
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
      .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")
      .replace(/^[ \t]{0,3}\d+[.)][ \t]+/gm, "")
      // Emphasis: **bold**, *italic*, __bold__, _italic_, ~~strike~~.
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s.,;:!?)]|$)/g, "$1$2")
      .replace(/~~(.*?)~~/g, "$1")
      // Horizontal rules and table pipes.
      .replace(/^[ \t]{0,3}([-*_][ \t]?){3,}$/gm, "")
      .replace(/\|/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

/** The same text on one line, for a snippet or a subject. */
export const toOneLine = (value: string | null | undefined): string =>
  stripMarkdown(value)
    .replace(/\s*\n+\s*/g, " ")
    .trim();
