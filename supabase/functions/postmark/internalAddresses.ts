// The collaborating parties (Marketingbende, Online Matters, Groeien met Ads)
// all work INSIDE the CRM; a real client is never on one of these domains. A
// mail from/to an internal address (the inbound intake address, a team member,
// or anyone on a team domain) must therefore never spawn a "client" contact or
// a company named after the team — that is exactly how a forward to
// crm@inbound.marketingbende.nl once created a bogus "Inbound"/"Marketingbende"
// company.
const TEAM_DOMAINS = [
  "marketingbende.nl",
  "onlinematters.nl",
  "groeienmetads.nl",
];

const domainOf = (email: string): string =>
  (email.toLowerCase().split("@").at(-1) ?? "").trim();

/**
 * The three collaborating parties, as they are written in a From line.
 * "Groeien Met Ads <groeienmetads@gmail.com>" is our own side of a conversation
 * even though the address is a gmail one, so the domain rule below cannot see it.
 */
const PARTY_NAMES = ["marketingbende", "online matters", "groeien met ads"];

const normalizeName = (value: string): string =>
  value.toLowerCase().replace(/["']/g, "").replace(/\s+/g, " ").trim();

/**
 * Whether a display name belongs to our own side: a team member writing from a
 * private address, or one of the parties themselves. The CRM collected
 * "John Plantenga <johnnyplantenga@hotmail.com>" as a client with thirteen notes
 * because only the address was checked, and that address is not on a team domain.
 *
 * Costs nothing when wrong: a client who happens to share a name with a team
 * member is simply not auto-created, and can still be added by hand.
 */
export const isInternalDisplayName = (
  name: string,
  salesNames: string[],
): boolean => {
  const candidate = normalizeName(name ?? "");
  if (candidate.length < 4) return false;
  if (PARTY_NAMES.includes(candidate)) return true;
  return salesNames.some((salesName) => {
    const normalized = normalizeName(salesName);
    return normalized.length >= 4 && normalized === candidate;
  });
};

// Whether an email address belongs to the CRM's own side of a conversation
// (the inbound intake address, a sales user, or any address on a team domain
// or a subdomain of one, such as the inbound subdomain). Robust by DOMAIN, so
// it does not rely on the exact inbound address string matching a config value.
export const isInternalEmail = (
  email: string,
  {
    inboundEmail,
    salesEmails,
  }: { inboundEmail: string; salesEmails: string[] },
): boolean => {
  const e = (email ?? "").toLowerCase().trim();
  if (!e || !e.includes("@")) return true; // no/garbage address is never a client
  if (inboundEmail && e === inboundEmail.toLowerCase().trim()) return true;
  if (salesEmails.some((s) => s.toLowerCase().trim() === e)) return true;

  const domain = domainOf(e);
  if (!domain) return true;

  const teamDomains = new Set(
    [
      ...TEAM_DOMAINS,
      ...salesEmails.map(domainOf),
      domainOf(inboundEmail),
    ].filter(Boolean),
  );
  for (const teamDomain of teamDomains) {
    if (domain === teamDomain || domain.endsWith(`.${teamDomain}`)) {
      return true;
    }
  }
  return false;
};
