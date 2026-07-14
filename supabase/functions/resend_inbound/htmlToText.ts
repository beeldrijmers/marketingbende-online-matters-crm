// HTML mail is untrusted input. Convert it to plain text with a small scanner
// instead of regex-based tag stripping: regex sanitizers can be bypassed with
// nested or malformed tags, and repeatedly replacing entities can double-decode
// attacker-controlled content. This parser never returns markup for rendering.

const BLOCK_TAGS = new Set([
  "blockquote",
  "br",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "p",
  "table",
  "tr",
]);

const SKIPPED_TAGS = new Set(["script", "style"]);

const findTagEnd = (html: string, start: number): number => {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
};

const readTag = (rawTag: string): { closing: boolean; name: string } | null => {
  const trimmed = rawTag.trim();
  const closing = trimmed.startsWith("/");
  let index = closing ? 1 : 0;
  while (index < trimmed.length && /\s/.test(trimmed[index])) index += 1;
  const start = index;
  const firstCode = trimmed.charCodeAt(index);
  const startsWithLetter =
    (firstCode >= 65 && firstCode <= 90) ||
    (firstCode >= 97 && firstCode <= 122);
  if (!startsWithLetter) return null;
  while (index < trimmed.length) {
    const code = trimmed.charCodeAt(index);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const isDigit = code >= 48 && code <= 57;
    if (!isLetter && !isDigit && trimmed[index] !== "-") break;
    index += 1;
  }
  if (index === start) return null;
  return {
    closing,
    name: trimmed.slice(start, index).toLowerCase(),
  };
};

const decodeEntity = (_match: string, entity: string): string => {
  const normalized = entity.toLowerCase();
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  if (named[normalized]) return named[normalized];

  const radix = normalized.startsWith("#x") ? 16 : 10;
  const digits = normalized.slice(radix === 16 ? 2 : 1);
  const codePoint = Number.parseInt(digits, radix);
  if (
    !Number.isFinite(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return _match;
  }
  return String.fromCodePoint(codePoint);
};

export const htmlToText = (html: string): string => {
  const lowerHtml = html.toLowerCase();
  let output = "";
  let index = 0;
  let skippedTag: string | null = null;

  while (index < html.length) {
    if (skippedTag) {
      const closingStart = lowerHtml.indexOf(`</${skippedTag}`, index);
      if (closingStart === -1) break;
      const closingEnd = findTagEnd(html, closingStart + 2);
      if (closingEnd === -1) break;
      skippedTag = null;
      index = closingEnd + 1;
      continue;
    }

    if (html.startsWith("<!--", index)) {
      const commentEnd = html.indexOf("-->", index + 4);
      index = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    if (html[index] !== "<") {
      output += html[index];
      index += 1;
      continue;
    }

    const tagEnd = findTagEnd(html, index + 1);
    if (tagEnd === -1) {
      output += html.slice(index);
      break;
    }
    const tag = readTag(html.slice(index + 1, tagEnd));
    if (!tag) {
      output += "<";
      index += 1;
      continue;
    }

    if (!tag.closing && SKIPPED_TAGS.has(tag.name)) {
      skippedTag = tag.name;
    } else if (
      (tag.closing && BLOCK_TAGS.has(tag.name)) ||
      tag.name === "br" ||
      tag.name === "hr"
    ) {
      output += "\n";
    }
    index = tagEnd + 1;
  }

  return output
    .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|apos|gt|lt|nbsp|quot);/gi, decodeEntity)
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
