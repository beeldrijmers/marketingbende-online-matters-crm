import type { TrelloCardInput } from "./trelloCardTypes.ts";

const apiKey = Deno.env.get("TRELLO_API_KEY");
const token = Deno.env.get("TRELLO_TOKEN");
if (!apiKey || !token) {
  throw new Error("Missing TRELLO_API_KEY or TRELLO_TOKEN env variable");
}

interface TrelloApiCard {
  id: string;
  name: string;
  idList: string;
  due: string | null;
  dueComplete: boolean;
  shortUrl: string;
  labels: { name: string }[];
}

// Webhook payloads only carry a partial snapshot of the card depending on
// the action type, so we always re-fetch the full, authoritative card from
// Trello's REST API before resolving deal fields from it.
export const fetchTrelloCard = async (
  cardId: string,
): Promise<TrelloCardInput> => {
  const url = new URL(`https://api.trello.com/1/cards/${cardId}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("fields", "name,idList,due,dueComplete,shortUrl");
  url.searchParams.set("labels", "true");
  url.searchParams.set("label_fields", "name");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch Trello card ${cardId}: ${response.status} ${await response.text()}`,
    );
  }
  const card = (await response.json()) as TrelloApiCard;

  return {
    id: card.id,
    name: card.name,
    idList: card.idList,
    labelNames: card.labels.map((label) => label.name),
    due: card.due,
    dueComplete: card.dueComplete,
    url: card.shortUrl,
  };
};
