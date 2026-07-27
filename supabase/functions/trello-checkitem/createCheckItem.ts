type FetchLike = (
  input: string,
  init?: { method?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

/** Naam van de lijst die we maken als de kaart er nog geen heeft. */
export const DEFAULT_CHECKLIST_NAME = "Stappen";

type Checklist = { id: string; name?: string };

/**
 * De lijst waar een nieuwe stap in hoort.
 *
 * De sync leest alle checklists van een kaart plat, dus welke het is maakt voor
 * het terugkomen niet uit. Wel voor een mens die naar de kaart kijkt: een tweede
 * lijst naast een bestaande leest als twee soorten werk. Dus de eerste die er is,
 * en anders een nieuwe.
 */
export const pickChecklist = (checklists: Checklist[]): Checklist | null => {
  const named = checklists.find(
    (list) =>
      (list.name ?? "").toLowerCase() === DEFAULT_CHECKLIST_NAME.toLowerCase(),
  );
  return named ?? checklists[0] ?? null;
};

const trelloUrl = (path: string, apiKey: string, token: string): URL => {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  return url;
};

const call = async (
  fetchImpl: FetchLike,
  url: URL,
  method: string,
): Promise<unknown> => {
  const response = await fetchImpl(url.toString(), { method });
  if (!response.ok) {
    throw new Error(
      `Trello ${method} ${url.pathname} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
};

/**
 * Zet een taak uit het CRM als checklistitem op de Trello-kaart.
 *
 * Zonder dit blijft het bord de bron en het CRM een kijkvenster: een taak die je
 * in Kompas maakt ziet niemand op de kaart, en van de 498 taken was er dan ook
 * geen enkele in het CRM gemaakt. Geeft het id van het nieuwe item terug, zodat
 * het afvinken daarna langs de bestaande weg terug kan.
 */
export const createCheckItem = async ({
  cardId,
  name,
  apiKey,
  token,
  fetchImpl = fetch as unknown as FetchLike,
}: {
  cardId: string;
  name: string;
  apiKey: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<string> => {
  const existing = (await call(
    fetchImpl,
    trelloUrl(`cards/${cardId}/checklists`, apiKey, token),
    "GET",
  )) as Checklist[];

  let checklist = pickChecklist(Array.isArray(existing) ? existing : []);
  if (!checklist) {
    const created = trelloUrl(`cards/${cardId}/checklists`, apiKey, token);
    created.searchParams.set("name", DEFAULT_CHECKLIST_NAME);
    checklist = (await call(fetchImpl, created, "POST")) as Checklist;
  }

  const item = trelloUrl(
    `checklists/${checklist.id}/checkItems`,
    apiKey,
    token,
  );
  item.searchParams.set("name", name);
  // Geen datum meegeven. Vervaldatums op checklistitems zijn een betaalde
  // Trello-functie: op dit bord neemt de API de waarde niet aan, niet bij het
  // aanmaken en niet met een PUT erna (nagemeten op een echte kaart, due bleef
  // null). Meesturen zou suggereren dat de datum meereist. De datum blijft in
  // Kompas staan; hem in de naam plakken kan niet, want de sync spiegelt die naam
  // terug naar de taaktekst.
  const result = (await call(fetchImpl, item, "POST")) as { id?: string };

  if (!result?.id) throw new Error("Trello returned no checkItem id");
  return result.id;
};
