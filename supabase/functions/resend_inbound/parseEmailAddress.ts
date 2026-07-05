// Resend gives recipients/sender as header strings that may be a bare address
// ("john@x.com") or a display-name form ('"John Doe" <john@x.com>'). These pure
// helpers normalise them into the { Email, Name } shape the shared mail-routing
// helpers expect. No I/O — trivially testable.

export const parseEmailAddress = (value: string): string => {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  return (angle ? angle[1] : value).trim().toLowerCase();
};

export const parseEmailContact = (
  value: string,
): { Email: string; Name: string } => {
  const email = parseEmailAddress(value);
  // Display name: everything before the "<", stripped of surrounding quotes.
  const nameMatch = value.match(/^\s*"?([^"<]+?)"?\s*</);
  const name = nameMatch ? nameMatch[1].trim() : "";
  return { Email: email, Name: name };
};

export const parseEmailContacts = (
  values: string[] | undefined,
): { Email: string; Name: string }[] =>
  (values ?? []).map(parseEmailContact).filter((contact) => contact.Email);
