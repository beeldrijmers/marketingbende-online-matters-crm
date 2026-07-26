/**
 * De verwijzing naar de wachtwoordkluis van een bedrijf.
 *
 * In het CRM staat nooit een geheim, alleen een link naar het item in de kluis.
 * Daarom is de enige echte regel hier: het moet een link zijn waar je op kunt
 * klikken, en https, want een kluis over http bestaat niet en een `javascript:`
 * of `data:`-URL in een href is een openstaande deur.
 */

export type VaultLink = {
  url: string;
  /** Waar de link naartoe gaat, kort genoeg voor een knop. */
  label: string;
};

const KNOWN_HOSTS: { pattern: RegExp; label: string }[] = [
  { pattern: /(^|\.)bitwarden\.com$/, label: "Bitwarden" },
  { pattern: /(^|\.)bitwarden\.eu$/, label: "Bitwarden" },
  { pattern: /(^|\.)1password\.com$/, label: "1Password" },
  { pattern: /(^|\.)proton\.me$/, label: "Proton Pass" },
  { pattern: /(^|\.)icloud\.com$/, label: "Apple Wachtwoorden" },
];

/**
 * Leest een ingevoerde waarde uit als kluislink, of geeft null als er niets
 * bruikbaars staat. Een lege waarde is geen fout: de meeste bedrijven hebben
 * (nog) geen kluisitem.
 */
export const parseVaultLink = (value?: string | null): VaultLink | null => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const known = KNOWN_HOSTS.find((candidate) => candidate.pattern.test(host));
  return { url: parsed.toString(), label: known ? known.label : host };
};

/** De melding bij een waarde die geen kluislink is, of undefined als hij klopt. */
export const validateVaultLink = (
  value?: string | null,
): string | undefined => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  return parseVaultLink(trimmed)
    ? undefined
    : "Vul een volledige https-link naar het item in de kluis in.";
};
