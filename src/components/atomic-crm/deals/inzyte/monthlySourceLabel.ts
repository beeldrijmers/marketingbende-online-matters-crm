import type { InzyteSourceKey } from "./inzyteVerification";

/**
 * Wat er over een meetbron in de maandrapportage staat.
 *
 * Hier ging het mis: het label kwam alleen uit de rapportdata. Staat daar geen
 * status, dan zei de chip "Niet gekoppeld", ook als de GA4-property wel degelijk
 * aan de opdracht hing. En omdat de generator een bron pas ophaalt zodra hij
 * bevestigd is, is dat precies het geval waarin je het label het meest leest.
 *
 * Gevolg voor de gebruiker: "GA4 niet gekoppeld" naast een badge die zegt
 * "GA4-brongegevens niet bevestigd", en dan ga je een property koppelen die er al
 * is. De koppelstatus hoort dus mee te wegen, niet alleen de rapportdata.
 */

export type MonthlySourceKey =
  | "ga4"
  | "searchConsole"
  | "businessProfile"
  | "googleAds";

/** De koppeling van een bron: hangt hij aan de opdracht, en is hij bevestigd. */
export type SourceLink = {
  configured: boolean;
  verified: boolean;
};

const VERIFICATION_KEY: Record<MonthlySourceKey, InzyteSourceKey> = {
  ga4: "ga4",
  searchConsole: "gsc",
  businessProfile: "gbp",
  googleAds: "ads",
};

export const verificationKeyFor = (key: MonthlySourceKey): InzyteSourceKey =>
  VERIFICATION_KEY[key];

export const monthlySourceLabel = ({
  link,
  hasStatus,
  bothMonthsMeasured,
  hasUsableMetrics,
  failed,
}: {
  /** Koppelstatus van deze bron, of undefined als die niet bekend is. */
  link?: SourceLink;
  /** Of de rapportdata iets over deze bron zegt. */
  hasStatus: boolean;
  bothMonthsMeasured: boolean;
  hasUsableMetrics: boolean;
  failed: boolean;
}): { ok: boolean; label: string } => {
  if (bothMonthsMeasured) {
    return hasUsableMetrics
      ? { ok: true, label: "Beide maanden gemeten" }
      : { ok: false, label: "Geen bruikbare kerncijfers" };
  }
  if (failed) return { ok: false, label: "Tijdelijk niet beschikbaar" };

  if (!hasStatus) {
    // Zonder koppelstatus weten we het niet beter dan voorheen.
    if (!link) return { ok: false, label: "Niet gekoppeld" };
    if (!link.configured) return { ok: false, label: "Niet gekoppeld" };
    return link.verified
      ? { ok: false, label: "Gekoppeld, geen cijfers in deze maand" }
      : { ok: false, label: "Gekoppeld, nog niet bevestigd" };
  }

  if (link && link.configured && !link.verified) {
    return { ok: false, label: "Gekoppeld, nog niet bevestigd" };
  }
  return { ok: false, label: "Onvolledig" };
};
