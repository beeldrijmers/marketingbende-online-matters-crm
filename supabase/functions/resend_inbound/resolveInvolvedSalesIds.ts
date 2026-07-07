const EMAIL_RE = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;

// Recipient/sender header lines of a forwarded block, in the languages the team
// uses. Only addresses on THESE lines are treated as involved parties; a bare
// address buried in quoted body prose does not grant deal access.
const FORWARD_HEADER_LINE_RE =
  /^\s*(?:>+\s*)?(?:To|Cc|Bcc|From|Sender|Reply-To|Aan|Van|Kopie|Beantwoorden aan|À|De|Copie)\s*:/i;

// Extracts the email addresses that appear on forwarded-header lines only.
// Resend's inbound API exposes only recipients on the receiving domain, so a
// colleague on another domain is invisible in the envelope but shows up in the
// quoted "To/Cc/Van/Aan/From" lines of a forwarded mail. Scanning ONLY those
// lines (not the whole body) is deliberate: an address quoted deep in an
// unrelated thread must never turn a colleague into a deal assignee (and hand
// them read access to the deal and its notes via RLS).
export const extractForwardedHeaderEmails = (bodyText: string): string[] =>
  bodyText
    .split(/\r?\n/)
    .filter((line) => FORWARD_HEADER_LINE_RE.test(line))
    .flatMap((line) => line.match(EMAIL_RE) ?? []);

// Every CRM team member (sales user) who appears in the envelope (From/To/Cc)
// or on a forwarded-header line of the body is an involved party, and therefore
// a deal assignee. Result is deduplicated, first-seen order, case-insensitive.
export const resolveInvolvedSalesIds = (
  envelopeEmails: string[],
  bodyText: string,
  salesByEmail: Map<string, number>,
): number[] => {
  const headerEmails = extractForwardedHeaderEmails(bodyText);
  return [
    ...new Set(
      [...envelopeEmails, ...headerEmails]
        .map((email) => salesByEmail.get(email.toLowerCase()))
        .filter((id): id is number => id != null),
    ),
  ];
};
