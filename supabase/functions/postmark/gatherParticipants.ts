import { isAutomatedAddress } from "./automatedSenders.ts";
import { extractMailContactData } from "./extractMailContactData.ts";
import { isInternalEmail } from "./internalAddresses.ts";

// From a set of mail recipients (To + Cc, or emails parsed from a forwarded
// body), keep only the CLIENT participants: drop every INTERNAL address (the
// inbound intake address, any team/sales member, and anyone on a team domain
// or its subdomains — see isInternalEmail), drop send-only machine addresses
// (see isAutomatedAddress), and de-duplicate by email. Pure — trivially
// testable. The result feeds getOrCreateContact + note creation, so an unknown
// participant becomes a new contact automatically; filtering the team's own
// side prevents bogus "Inbound"/"Marketingbende" clients, and filtering machine
// mail prevents clients called Netflix, GitHub and WeTransfer.
export const gatherClientParticipants = ({
  recipients,
  salesEmails,
  inboundEmail,
}: {
  recipients: { Email: string; Name: string }[];
  salesEmails: string[];
  inboundEmail: string;
}) => {
  const seen = new Set<string>();

  return extractMailContactData(recipients).filter((contact) => {
    if (!contact.email) return false;
    if (isInternalEmail(contact.email, { inboundEmail, salesEmails })) {
      return false;
    }
    if (isAutomatedAddress(contact.email)) return false;
    if (seen.has(contact.email)) return false;
    seen.add(contact.email);
    return true;
  });
};
