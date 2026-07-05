import { extractMailContactData } from "./extractMailContactData.ts";

// From a set of mail recipients (To + Cc, or emails parsed from a forwarded
// body), keep only the CLIENT participants: drop the inbound intake address and
// any team (sales) address, and de-duplicate by email. Pure — trivially
// testable. The result feeds getOrCreateContact + note creation, so an unknown
// participant becomes a new contact automatically.
export const gatherClientParticipants = ({
  recipients,
  salesEmails,
  inboundEmail,
}: {
  recipients: { Email: string; Name: string }[];
  salesEmails: string[];
  inboundEmail: string;
}) => {
  const salesSet = new Set(salesEmails.map((email) => email.toLowerCase()));
  const inbound = inboundEmail.toLowerCase();
  const seen = new Set<string>();

  return extractMailContactData(recipients).filter((contact) => {
    if (!contact.email) return false;
    if (contact.email === inbound) return false;
    if (salesSet.has(contact.email)) return false;
    if (seen.has(contact.email)) return false;
    seen.add(contact.email);
    return true;
  });
};
