import { stripMarkdown } from "../misc/plainText";

/**
 * What may leave the building.
 *
 * A status update is composed from CRM data, and CRM data is written for us. The
 * board proved it the hard way: an intake card produced the line
 *
 *   "Rick belt de heer Mohammed Nadi via +31 6 50610409 voor introductie"
 *
 * which names our own colleague, quotes the client's phone number back at him,
 * and describes an internal action. Alongside it: "Doelaccounts en beslissers
 * bepalen, waaronder Elkien en WoonFriesland" (our sales strategy) and "Rick
 * beoordeelt of het bij hem/Online Matters past" (an internal go/no-go).
 *
 * So the rule is inverted from the usual one: a sentence we wrote for the client
 * is safe, and anything derived from data is internal until it passes here.
 * Wrongly holding a line back costs a bullet in an update; wrongly letting one
 * through costs trust.
 */

/** Contact details of any kind: never ours to repeat, never news to them. */
const CONTACT_DETAILS = [
  /\+?\d[\d\s().-]{7,}\d/, // phone number in any Dutch notation
  /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i, // e-mail address
];

/**
 * Words that mark a line as our own bookkeeping. Kept deliberately narrow and
 * concrete: a broad list would silence half the legitimate work.
 */
const INTERNAL_VOCABULARY = [
  /\bintern(e|)\b/i,
  /\bbeoordeel\w*\b/i,
  /\bgo[/-]?no[/-]?go\b/i,
  /\bfit\b/i,
  /\bmarge\b/i,
  /\buurtarief\b/i,
  /\btarieven\b/i,
  /\bdoelaccounts?\b/i,
  /\bbeslissers?\b/i,
  /\bacquisitie\w*\b/i,
  /\blead(s|generatie|)\b/i,
  /\bprospect\w*\b/i,
  /\bopvolg(en|ing)\b/i,
  /\bnabellen\b/i,
  /\bintake\b/i,
  /\btrello\b/i,
  /\bcrm\b/i,
  /\bmoneybird\b/i,
  /\bcheckl?ist\b/i,
];

/** Our own side of the conversation: naming us is not reporting to them. */
const PARTY_NAMES = [
  /\bmarketingbende\b/i,
  /\bonline\s*matters\b/i,
  /\bgroeien\s*met\s*ads\b/i,
];

const nameParts = (fullName: string): string[] =>
  fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

/**
 * Whether a data-derived line may go to the client.
 *
 * `teamNames` are the full names of the team; both the whole name and a first
 * name on its own disqualify a line, because "Rick belt…" is exactly the case
 * that went wrong.
 */
export const isClientSafeLine = (
  text: string,
  teamNames: string[] = [],
): boolean => {
  const value = stripMarkdown(text);
  if (!value) return false;

  if (CONTACT_DETAILS.some((pattern) => pattern.test(value))) return false;
  if (INTERNAL_VOCABULARY.some((pattern) => pattern.test(value))) return false;
  if (PARTY_NAMES.some((pattern) => pattern.test(value))) return false;

  const words = new Set(
    value
      .toLowerCase()
      .split(/[^a-zà-ÿ]+/)
      .filter(Boolean),
  );
  for (const teamName of teamNames) {
    for (const part of nameParts(teamName)) {
      if (words.has(part.toLowerCase())) return false;
    }
  }
  return true;
};

/**
 * Work the client may read about, in the order given. Lines are cleaned of
 * markdown on the way out, because a client-facing text never shows syntax.
 */
export const clientSafeLines = (
  texts: string[],
  teamNames: string[] = [],
): string[] =>
  texts
    .map((text) =>
      stripMarkdown(text)
        .replace(/\s*\n+\s*/g, " ")
        .trim(),
    )
    .filter((text) => text && isClientSafeLine(text, teamNames));

/**
 * How to describe the work itself.
 *
 * The assignment's name is a Trello card title — our shorthand, sometimes with a
 * colleague's name in it. A client recognises their own project by what it is, so
 * that is what an update calls it, and the card title is only used when it is
 * safe AND actually says something about the work.
 */
const CATEGORY_PHRASE: Record<string, string> = {
  seo: "het SEO-werk",
  "website-development": "uw website",
  "website-optimalisatie": "de website-optimalisatie",
  eenmalig: "de opdracht",
  happr: "het werk aan Happr",
  overig: "de opdracht",
};

export const describeWork = ({
  category,
  dealName,
  stage,
  teamNames = [],
}: {
  category?: string | null;
  dealName: string;
  stage: string;
  teamNames?: string[];
}): string => {
  // Nothing is agreed yet at this stage, so there is no "work" to name; the
  // subject is their request.
  if (stage === "informatie-pipeline") return "uw aanvraag";

  const phrase = category ? CATEGORY_PHRASE[category] : undefined;
  const safeName = isClientSafeLine(dealName, teamNames)
    ? stripMarkdown(dealName)
    : null;
  return phrase ?? safeName ?? "de opdracht";
};
