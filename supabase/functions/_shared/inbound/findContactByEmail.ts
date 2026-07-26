import { supabaseAdmin } from "../supabaseAdmin.ts";

/**
 * Het contact bij een e-mailadres, of null.
 *
 * Vijf plekken deden dit zelf, vier met `maybeSingle()`. Twee contactrijen met
 * hetzelfde adres maken daar een fout van, en in het Gmail-pad is dat stil
 * dodelijk: de claim in `inbound_email_events` wordt dan niet vrijgegeven,
 * terwijl de functie wel 200 teruggeeft, dus de history-cursor schuift door en
 * die mail is nooit meer te zien.
 *
 * Daarom hier centraal, en met een vaste ordening op id: de vier lezers moeten
 * dezelfde rij kiezen, anders landt de notitie bij contact A terwijl het
 * opdracht-pad met het bedrijf van contact B werkt.
 *
 * Gooit niet zelf: de aanroepers gaan verschillend om met een leesfout (de een
 * throwt, de ander slaat de mail over), en die keuze hoort bij hen te blijven.
 */
export const findContactByEmail = async (
  email: string,
  columns = "id",
): Promise<{
  contact: Record<string, unknown> | null;
  error: { message: string } | null;
}> => {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(columns)
    .contains("email_jsonb", JSON.stringify([{ email }]))
    .order("id", { ascending: true })
    .limit(1);

  return {
    contact: (data?.[0] as Record<string, unknown> | undefined) ?? null,
    error: error ?? null,
  };
};
