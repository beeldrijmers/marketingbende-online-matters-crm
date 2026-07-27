/**
 * De maandrapportage draait vanzelf bij maandafsluiting.
 *
 * Zo was het: elke rapportage moest per klant met de hand worden aangezet. Het
 * gevolg was zichtbaar in productie: achttien meetkoppelingen, drie rapportages,
 * alle drie over dezelfde maand. En omdat een meetbron pas "bevestigd" raakt
 * zodra er echt cijfers zijn opgehaald, bleven ook die bevestigingen leeg. Werk
 * dat je moet gaan halen, haal je niet.
 *
 * Wie hoort erbij: alleen vaste klanten. Een maandrapportage over een eenmalige
 * opdracht die vorig jaar is opgeleverd is geen rapportage maar ruis.
 *
 * Wat er nooit gebeurt: een bestaande rapportage overschrijven. Genereren is een
 * upsert die samenvatting, werkomschrijving en de status terugzet naar concept.
 * Draait de taak over een maand die al een rapportage heeft, dan zou met de hand
 * geschreven tekst verdwijnen en zou een afgeronde rapportage weer concept
 * worden. De taak slaat zo'n maand daarom over, en dat maakt hem meteen veilig
 * om vaker te draaien dan strikt nodig.
 */

export const RECURRING_STAGE = "maandelijks";

/**
 * Hoeveel rapportages per aanroep. Een edge function heeft een wandkloklimiet en
 * één rapportage haalt meerdere meetbronnen op over twee periodes. Liever een
 * paar per keer en vaker draaien dan één lange aanroep die halverwege wordt
 * afgekapt: wat blijft liggen wordt het volgende uur opgepakt.
 */
export const REPORTS_PER_RUN = 3;

export type SchedulableLink = {
  deal_id: number | string;
  ga4_connection_id?: string | null;
  ga4_property_id?: string | null;
  gsc_site_url?: string | null;
  gbp_location_id?: string | null;
  ads_customer_id?: string | null;
};

/**
 * Een koppeling zonder ingestelde bron levert een rapportage zonder cijfers op.
 * Die hoort niet vanzelf te ontstaan; iemand moet dan eerst een bron kiezen.
 */
export const hasConfiguredSource = (link: SchedulableLink): boolean =>
  Boolean(
    (link.ga4_connection_id && link.ga4_property_id) ||
      link.gsc_site_url ||
      link.gbp_location_id ||
      link.ads_customer_id,
  );

/**
 * Welke opdrachten deze aanroep oppakt: vaste klanten met een ingestelde bron
 * die over deze maand nog geen rapportage hebben. Vaste volgorde op opdracht-id,
 * zodat opeenvolgende aanroepen elkaar aanvullen in plaats van overlappen.
 */
export const pendingReportDeals = ({
  links,
  reportedDealIds,
  limit = REPORTS_PER_RUN,
}: {
  links: SchedulableLink[];
  reportedDealIds: Iterable<number>;
  limit?: number;
}): number[] => {
  const done = new Set(Array.from(reportedDealIds, Number));
  return links
    .filter(hasConfiguredSource)
    .map((link) => Number(link.deal_id))
    .filter((dealId) => Number.isFinite(dealId) && !done.has(dealId))
    .sort((left, right) => left - right)
    .slice(0, Math.max(0, limit));
};

export type ScheduledReportOutcome = {
  dealId: number;
  ok: boolean;
  error?: string;
};

/**
 * Eén mislukte klant mag de rest niet tegenhouden: een verlopen Google-koppeling
 * bij klant A is geen reden om klant B geen rapportage te geven.
 */
export const runScheduledReports = async ({
  dealIds,
  generate,
}: {
  dealIds: number[];
  generate: (dealId: number) => Promise<unknown>;
}): Promise<ScheduledReportOutcome[]> => {
  const outcomes: ScheduledReportOutcome[] = [];
  for (const dealId of dealIds) {
    try {
      await generate(dealId);
      outcomes.push({ dealId, ok: true });
    } catch (error) {
      outcomes.push({
        dealId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
};
