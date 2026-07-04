const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Detects a per-deal forwarding address among a list of recipients
 * (e.g. "deal-42@inbound.example.com") and returns the matched deal id.
 */
export const extractDealIdFromEmails = (
  emails: { Email: string }[],
  inboundDomain: string,
): number | null => {
  if (!inboundDomain) return null;

  const pattern = new RegExp(
    `^deal-(\\d+)@${escapeRegExp(inboundDomain.toLowerCase())}$`,
  );

  for (const { Email } of emails) {
    const match = (Email || "").toLowerCase().match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
};
