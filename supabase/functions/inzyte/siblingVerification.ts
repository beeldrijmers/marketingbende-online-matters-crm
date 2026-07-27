/**
 * Een bevestigde meetbron geldt voor de hele klant, niet voor één opdracht.
 *
 * De koppelingen staan per opdracht, en dat is op zich goed: een klant kan meer
 * dan één traject hebben. Maar de bron is dezelfde. Hunting XL had vier
 * opdrachten met exact dezelfde GA4-property, dus moest je vier keer hetzelfde
 * bevestigen, en tot dat moment liet elke rapportage de cijfers weg. Dat is de
 * reden dat er in productie achttien koppelingen stonden en nul bevestigd waren.
 *
 * Dus: bevestig je een bron, dan krijgen de andere opdrachten van diezelfde klant
 * met exact dezelfde bron dat stempel er ook op. Exact dezelfde bron, want een
 * andere property is een andere meting en die hoort zijn eigen controle te krijgen.
 */

export type VerificationField =
  | "ga4_verified_at"
  | "gsc_verified_at"
  | "gbp_verified_at"
  | "ads_verified_at";

type LinkLike = {
  id: number | string;
  company_id: number | string | null;
  ga4_property_id?: string | null;
  gsc_site_url?: string | null;
  gbp_location_id?: string | null;
  ads_customer_id?: string | null;
};

const IDENTIFIER: Record<VerificationField, keyof LinkLike> = {
  ga4_verified_at: "ga4_property_id",
  gsc_verified_at: "gsc_site_url",
  gbp_verified_at: "gbp_location_id",
  ads_verified_at: "ads_customer_id",
};

/**
 * Waarop de andere koppelingen van deze klant gevonden worden, of null als dat
 * niet kan (geen klant of geen bron-id): dan blijft de bevestiging bij deze ene
 * opdracht en gebeurt er niets onverwachts.
 */
export const siblingVerificationMatch = (
  link: LinkLike,
  field: VerificationField,
): { companyId: number | string; column: string; value: string } | null => {
  if (link.company_id == null) return null;
  const column = IDENTIFIER[field];
  const value = link[column];
  if (typeof value !== "string" || value.trim() === "") return null;
  return { companyId: link.company_id, column: String(column), value };
};
