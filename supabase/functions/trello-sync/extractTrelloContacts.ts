import { isAutomatedAddress } from "../postmark/automatedSenders.ts";

const INTERNAL_DOMAINS = new Set([
  "marketingbende.nl",
  "onlinematters.nl",
  "groeienmetads.nl",
  "trello.com",
]);

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Kaarten bevatten vaak een geplakte bounce of notificatiemail, en daaruit kwam
// "Mailer Daemon" als contactpersoon bij een echte klant terecht. De mailintake
// wist dat al; hier wordt hetzelfde oordeel hergebruikt in plaats van een
// tweede lijstje dat achterloopt.
export const extractTrelloContactEmails = (text: string): string[] =>
  Array.from(
    new Set(
      (text.match(EMAIL_PATTERN) ?? [])
        .map((email) => email.toLowerCase())
        .filter((email) => !INTERNAL_DOMAINS.has(email.split("@")[1] ?? ""))
        .filter((email) => !isAutomatedAddress(email)),
    ),
  ).slice(0, 10);

export const contactNameFromEmail = (
  email: string,
  companyName: string,
): { firstName: string; lastName: string } => {
  const localPart = email.split("@")[0] ?? "";
  const genericAliases = new Set([
    "admin",
    "contact",
    "factuur",
    "finance",
    "hello",
    "info",
    "office",
    "support",
  ]);
  if (genericAliases.has(localPart.toLowerCase())) {
    return { firstName: companyName, lastName: "" };
  }

  const parts = localPart
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  return {
    firstName: parts[0] ?? companyName,
    lastName: parts.slice(1).join(" "),
  };
};
