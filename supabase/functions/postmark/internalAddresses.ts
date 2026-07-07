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
