const EMAIL_RE = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;

// Every CRM team member (sales user) who appears anywhere in the mail - the
// envelope (From/To/Cc) OR the body/forwarded headers - is an involved party,
// and therefore a deal assignee. The body is scanned too because Resend's
// inbound API only exposes recipients on the receiving domain, so a colleague
// on another domain (e.g. a partner) is invisible in the envelope but does
// show up in the quoted "To/Cc/Van/Aan" lines of a forwarded mail. Result is
// deduplicated, first-seen order, case-insensitive.
export const resolveInvolvedSalesIds = (
  envelopeEmails: string[],
  bodyText: string,
  salesByEmail: Map<string, number>,
): number[] => {
  const bodyEmails = bodyText.match(EMAIL_RE) ?? [];
  return [
    ...new Set(
      [...envelopeEmails, ...bodyEmails]
        .map((email) => salesByEmail.get(email.toLowerCase()))
        .filter((id): id is number => id != null),
    ),
  ];
};
