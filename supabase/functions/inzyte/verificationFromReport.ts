import type { VerificationField } from "./siblingVerification.ts";

/**
 * "Bevestigd" hoort een uitkomst te zijn, geen voorwaarde.
 *
 * Zo was het: de rapportage haalde een meetbron alleen op als die al bevestigd
 * was, en bevestigen kon alleen door de bron met de hand opnieuw op te slaan. Voor
 * koppelingen die uit een import kwamen sloot die cirkel nooit: achttien
 * koppelingen in productie, allemaal met een echte GA4-property, geen enkele
 * bevestigd, en dus maandrapportages zonder cijfers terwijl de gegevens er waren.
 *
 * Nu wordt een geconfigureerde bron gewoon geprobeerd. Komt er data terug, dan is
 * dat het bewijs en zetten we het stempel. Mislukt het, dan zegt de rapportage dat
 * per bron, en dat is eerlijker dan een bron die stil wordt overgeslagen.
 */

type SourceOutcome = { status?: string } | null | undefined;

const succeeded = (current: SourceOutcome, previous: SourceOutcome): boolean =>
  current?.status === "success" || previous?.status === "success";

/**
 * Welke bevestigingsvelden dit rapport heeft verdiend: alleen voor bronnen die
 * daadwerkelijk data teruggaven en die nog geen stempel hadden.
 */
export const verificationFromReport = ({
  link,
  ga4,
  gsc,
  gbp,
  ads,
}: {
  link: Record<string, unknown> | null;
  ga4: { current?: SourceOutcome; previous?: SourceOutcome };
  gsc: { current?: SourceOutcome; previous?: SourceOutcome };
  gbp: { current?: SourceOutcome; previous?: SourceOutcome };
  ads: { current?: SourceOutcome; previous?: SourceOutcome };
}): VerificationField[] => {
  if (!link) return [];
  const pairs: [VerificationField, boolean][] = [
    ["ga4_verified_at", succeeded(ga4.current, ga4.previous)],
    ["gsc_verified_at", succeeded(gsc.current, gsc.previous)],
    ["gbp_verified_at", succeeded(gbp.current, gbp.previous)],
    ["ads_verified_at", succeeded(ads.current, ads.previous)],
  ];
  return pairs
    .filter(([field, ok]) => ok && !link[field])
    .map(([field]) => field);
};
