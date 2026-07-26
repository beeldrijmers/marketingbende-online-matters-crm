import { isAutomatedAddress } from "./automatedSenders.ts";
import { extractMailContactData } from "./extractMailContactData.ts";
import { isInternalDisplayName, isInternalEmail } from "./internalAddresses.ts";

// From a set of mail recipients (To + Cc, or emails parsed from a forwarded
// body), keep only the CLIENT participants and de-duplicate by email. Pure —
// trivially testable. The result feeds getOrCreateContact + note creation, so an
// unknown participant becomes a new contact automatically, which is why three
// kinds of non-client have to be filtered out first:
//
//   - internal ADDRESSES: the intake address, a sales login, a team domain or
//     one of its subdomains (isInternalEmail) — otherwise a forward creates an
//     "Inbound"/"Marketingbende" client;
//   - internal NAMES: a team member writing from a private address, or a party
//     itself (isInternalDisplayName) — the CRM had John himself as a client with
//     thirteen notes, from his hotmail;
//   - machine addresses: noreply, bounces, notifications (isAutomatedAddress) —
//     otherwise Netflix, GitHub and WeTransfer become clients.
export const gatherClientParticipants = ({
  recipients,
  salesEmails,
  salesNames = [],
  inboundEmail,
}: {
  recipients: { Email: string; Name: string }[];
  salesEmails: string[];
  /** Full names of the team, to recognise a colleague on a private address. */
  salesNames?: string[];
  inboundEmail: string;
}) => {
  const seen = new Set<string>();

  return extractMailContactData(recipients).filter((contact) => {
    if (!contact.email) return false;
    if (isInternalEmail(contact.email, { inboundEmail, salesEmails })) {
      return false;
    }
    if (isAutomatedAddress(contact.email)) return false;
    if (
      isInternalDisplayName(
        `${contact.firstName} ${contact.lastName}`.trim(),
        salesNames,
      )
    ) {
      return false;
    }
    if (seen.has(contact.email)) return false;
    seen.add(contact.email);
    return true;
  });
};
