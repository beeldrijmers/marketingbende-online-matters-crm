// Pure helper: find a candidate client website in a Trello card so the company
// gets a real logo (the company_saved DB trigger derives the logo/favicon from
// companies.website automatically). No I/O — trivially unit-testable.
//
// Marketing-agency cards often link the client's own site, either as an
// attachment or somewhere in the description. Links to Trello itself and to the
// usual tool/social hosts are NOT the client's website and are ignored.

const IGNORED_HOSTS = [
  "trello.com",
  "atlassian.net",
  "google.com",
  "docs.google.com",
  "drive.google.com",
  "sheets.google.com",
  "dropbox.com",
  "youtube.com",
  "youtu.be",
  "loom.com",
  "figma.com",
  "notion.so",
  "calendly.com",
  "zoom.us",
  "github.com",
  "gitlab.com",
  "canva.com",
  "wetransfer.com",
  "mailchimp.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "whatsapp.com",
  "wa.me",
  "bit.ly",
  "marketingbende.nl",
  "onlinematters.nl",
];

const isIgnored = (host: string): boolean =>
  IGNORED_HOSTS.some(
    (ignored) => host === ignored || host.endsWith(`.${ignored}`),
  );

// A blocklist can only ever name the tools we already thought of, and the CRM
// paid for that: cards linking timelines.ai, chatgpt.com, we.tl or
// themes.shopify.com handed those domains to the client as their website, and
// the logo trigger then stamped a stranger's favicon on the client. So a link
// must also LOOK like it belongs to this client: compare the letters of the
// company name against the letters of the host.
const lettersOf = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const GENERIC_NAME_TOKENS = new Set([
  "bv",
  "vof",
  "nv",
  "cv",
  "holding",
  "groep",
  "group",
  "de",
  "het",
  "een",
  "the",
]);

const nameLetters = (companyName: string): string =>
  lettersOf(
    companyName
      .split(/[\s/&,-]+/)
      .filter((token) => !GENERIC_NAME_TOKENS.has(token.toLowerCase()))
      .join(""),
  );

const belongsToCompany = (
  host: string,
  companyName?: string | null,
): boolean => {
  const name = companyName ? nameLetters(companyName) : "";
  // Without a name to compare against, keep the old blocklist-only behavior.
  if (name.length < 4) return true;
  const hostLetters = lettersOf(host);
  return (
    hostLetters.includes(name) || name.includes(lettersOf(host.split(".")[0]))
  );
};

// Returns a normalized "https://<domain>" for the first plausible client site,
// or null when the card contains none. Attachments are preferred over links
// found in the free-text description.
export const extractCompanyWebsite = (
  desc: string,
  attachmentUrls: string[],
  additionalTexts: string[] = [],
  companyName?: string | null,
): string | null => {
  const urlRegex = /https?:\/\/[^\s)<>"']+/gi;
  const fromDescription = (desc ?? "").match(urlRegex) ?? [];
  const fromAdditionalText = additionalTexts.flatMap(
    (text) => text.match(urlRegex) ?? [],
  );
  const candidates = [
    ...(attachmentUrls ?? []),
    ...fromDescription,
    ...fromAdditionalText,
  ];

  for (const candidate of candidates) {
    let host: string;
    try {
      host = new URL(candidate).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      continue; // not a valid URL
    }
    if (!host || !host.includes(".")) continue;
    if (isIgnored(host)) continue;
    if (!belongsToCompany(host, companyName)) continue;
    return `https://${host}`;
  }

  return null;
};
