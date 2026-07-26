// Machine mail is not a client relationship.
//
// The intake turns every non-internal address in From/To/Cc into a contact, a
// company and a deal. That is right for a real counterpart and wrong for the
// stream of platform mail a marketing agency receives: the CRM ended up with
// "clients" called Netflix, GitHub, Google, Trello and WeTransfer, each with a
// contact named noreply@ and a deal of its own.
//
// Two independent signals, both cheap:
//   1. the address itself announces that nobody reads replies;
//   2. the message announces that it was sent to a list or by a robot.
// Neither is applied to addresses that merely look corporate — info@ and
// support@ are how plenty of real Dutch clients write to us.

const AUTOMATED_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "nepantwoord",
  "geenantwoord",
  "mailer-daemon",
  "mailerdaemon",
  "postmaster",
  "bounce",
  "bounces",
  "notification",
  "notifications",
  "notificaties",
  "automated",
  "automailer",
  "robot",
  "mailbot",
  "daemon",
]);

/** "sc-noreply", "noreply-accounts", "bounces+123", "ci_activity" … */
const AUTOMATED_LOCAL_PART_PATTERN =
  /(^|[.\-_+])(no-?reply|donotreply|do-not-reply|bounces?|mailer-daemon|postmaster|notifications?)([.\-_+]|$)/i;

/** A "noreply.github.com"-style host is a send-only domain by construction. */
const AUTOMATED_DOMAIN_LABEL = /(^|\.)(no-?reply|donotreply|bounces?)(\.|$)/i;

export const isAutomatedAddress = (email: string): boolean => {
  const address = (email ?? "").toLowerCase().trim();
  if (!address.includes("@")) return false;

  const [localPart, domain] = [
    address.slice(0, address.lastIndexOf("@")),
    address.slice(address.lastIndexOf("@") + 1),
  ];
  if (AUTOMATED_LOCAL_PARTS.has(localPart)) return true;
  if (AUTOMATED_LOCAL_PART_PATTERN.test(localPart)) return true;
  return AUTOMATED_DOMAIN_LABEL.test(domain);
};

type HeaderInput =
  | Record<string, string | string[] | undefined>
  | { name?: string; key?: string; value?: string }[]
  | null
  | undefined;

const headerValue = (headers: HeaderInput, wanted: string): string => {
  if (!headers) return "";
  const target = wanted.toLowerCase();

  if (Array.isArray(headers)) {
    const match = headers.find(
      (header) => (header?.name ?? header?.key ?? "").toLowerCase() === target,
    );
    return (match?.value ?? "").trim();
  }

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === target,
  );
  const value = entry?.[1];
  return (Array.isArray(value) ? value.join(" ") : (value ?? "")).trim();
};

/**
 * Newsletters, receipts and platform notifications, recognised the way mail
 * clients do it. Providers hand headers over in either shape (a map or a
 * name/value list), and a provider that hands over none simply never matches.
 */
export const isBulkMail = (headers: HeaderInput): boolean => {
  if (headerValue(headers, "list-unsubscribe")) return true;
  if (headerValue(headers, "list-id")) return true;
  if (headerValue(headers, "feedback-id")) return true;

  const precedence = headerValue(headers, "precedence").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(precedence)) return true;

  const autoSubmitted = headerValue(headers, "auto-submitted").toLowerCase();
  return autoSubmitted !== "" && autoSubmitted !== "no";
};
