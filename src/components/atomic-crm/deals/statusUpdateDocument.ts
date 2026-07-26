/**
 * The printable version of a status update: one page that says exactly what the
 * copy button puts on the clipboard.
 *
 * It renders the text itself rather than a re-parsed structure. An earlier
 * version rebuilt headings and bullets from the edited text and turned the
 * greeting into a bullet and the sign-off into a planning item — two versions of
 * one update reaching the same client is worse than a plain letter.
 *
 * Deliberately a self-contained HTML string with inline styles: it is opened as
 * a blob in a new tab and printed from there, so it cannot rely on the app's
 * stylesheet being loaded.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Section headings ("Waar we staan:") carry weight; "- " becomes a bullet. */
const renderLine = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed) return "";
  const escaped = escapeHtml(trimmed);
  if (/:$/.test(trimmed) && !trimmed.startsWith("-")) {
    return `<strong>${escaped.slice(0, -1)}</strong>`;
  }
  return trimmed.startsWith("- ")
    ? `<span class="item">&#8226;&nbsp;&nbsp;${escaped.slice(2)}</span>`
    : escaped;
};

export const buildStatusUpdateDocument = ({
  body,
  companyName,
  dateLabel,
  subject,
}: {
  body: string;
  companyName: string;
  dateLabel: string;
  subject: string;
}): string => `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
    <style>
      @page { margin: 18mm 16mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
        color: #1d2333;
        line-height: 1.6;
        font-size: 11pt;
      }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 2px solid #4f46e5;
        padding-bottom: 10px;
      }
      .mark {
        font-size: 9pt;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #4f46e5;
      }
      .date { font-size: 9pt; color: #6b7280; }
      h1 { font-size: 17pt; margin: 24px 0 2px; }
      .client { font-size: 10pt; color: #6b7280; margin: 0 0 20px; }
      /* One line per line, so a heading and its bullets stay a block instead of
         drifting apart on br + block spacing. */
      .letter p { margin: 0 0 12px; }
      .line { display: block; }
      .item { padding-left: 2px; }
    </style>
  </head>
  <body>
    <header>
      <span class="mark">Kompas</span>
      <span class="date">${escapeHtml(dateLabel)}</span>
    </header>

    <h1>${escapeHtml(subject.replace(/^Statusupdate\s+/, ""))}</h1>
    <p class="client">Statusupdate voor ${escapeHtml(companyName)}</p>

    <div class="letter">
      ${body
        .split(/\n{2,}/)
        .map(
          (paragraph) =>
            `<p>${paragraph
              .split("\n")
              .map(renderLine)
              .filter(Boolean)
              .map((line) => `<span class="line">${line}</span>`)
              .join("")}</p>`,
        )
        .join("\n      ")}
    </div>
  </body>
</html>`;
