import type { Contact } from "../types";

/**
 * Naar wie correspondentie over een klant gaat.
 *
 * Bij een deel van het werk is de klant niet de partij die je aanschrijft. Werk
 * dat via Online Matters loopt gaat naar Rick, en Terschelling Recreatie loopt
 * via Studio Cupido: hun eindklanten aanschrijven gaat over het hoofd van de
 * partner heen. Het CRM wist dat niet en stelde gewoon het eerste contactadres
 * van het bedrijf voor.
 *
 * Daarom staat op het bedrijf een adres "correspondentie via". Staat dat er, dan
 * is dat het adres, en is elk ander adres een waarschuwing waard. Staat het er
 * niet, dan is de klant zelf het aanspreekpunt en verandert er niets.
 */

export type Correspondence = {
  /** Het adres waar een mail of uitnodiging naartoe hoort, als het bekend is. */
  email?: string;
  /** Waar of het via een partner loopt in plaats van rechtstreeks. */
  viaPartner: boolean;
  /** Wat er misgaat als je dit negeert, of undefined als er niets aan de hand is. */
  waarschuwing?: string;
};

const firstContactEmail = (contacts: Contact[]): string | undefined => {
  for (const contact of contacts) {
    const email = contact.email_jsonb?.find((entry) => entry.email)?.email;
    if (email) return email;
  }
  return undefined;
};

const normalise = (value?: string | null): string | undefined => {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : undefined;
};

/**
 * Kiest het adres voor een uitgaande actie, en zegt het als het niet het adres
 * van de klant zelf is.
 */
export const resolveCorrespondence = ({
  correspondenceEmail,
  contacts = [],
}: {
  correspondenceEmail?: string | null;
  contacts?: Contact[];
}): Correspondence => {
  const via = normalise(correspondenceEmail);
  const direct = firstContactEmail(contacts);

  if (!via) return { email: direct, viaPartner: false };

  return {
    email: via,
    viaPartner: true,
    waarschuwing:
      direct && normalise(direct) !== via
        ? `Correspondentie over deze klant loopt via ${via}. Schrijf ${direct} niet zelf aan.`
        : undefined,
  };
};

/**
 * Of een adres het aanschrijven van een eindklant zou zijn. Gebruikt om een
 * knop te laten waarschuwen in plaats van hem stil het verkeerde te laten doen.
 */
export const isBypassingPartner = (
  correspondenceEmail: string | null | undefined,
  address: string | null | undefined,
): boolean => {
  const via = normalise(correspondenceEmail);
  const target = normalise(address);
  return Boolean(via && target && via !== target);
};
