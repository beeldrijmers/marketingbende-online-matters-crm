// Every CRM team member (sales user) whose address appears in the mail envelope
// (From/To/Cc) is an involved party, and therefore a deal assignee. The result
// is deduplicated and preserves first-seen order. Matching is case-insensitive.
export const resolveInvolvedSalesIds = (
  envelopeEmails: string[],
  salesByEmail: Map<string, number>,
): number[] => [
  ...new Set(
    envelopeEmails
      .map((email) => salesByEmail.get(email.toLowerCase()))
      .filter((id): id is number => id != null),
  ),
];
