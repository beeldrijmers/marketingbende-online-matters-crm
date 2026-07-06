import type { TrelloCardInput } from "./trelloCardTypes.ts";
import {
  parseTrelloApiCard,
  type TrelloApiCard,
} from "./parseTrelloApiCard.ts";

const apiKey = Deno.env.get("TRELLO_API_KEY");
const token = Deno.env.get("TRELLO_TOKEN");
if (!apiKey || !token) {
  throw new Error("Missing TRELLO_API_KEY or TRELLO_TOKEN env variable");
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
  url.searchParams.set("fields", "name,idList,due,dueComplete,shortUrl,desc");
  url.searchParams.set("labels", "true");
  url.searchParams.set("label_fields", "name");
  url.searchParams.set("attachments", "true");
  url.searchParams.set("attachment_fields", "url,name");
  url.searchParams.set("members", "true");
  url.searchParams.set("member_fields", "fullName");
  url.searchParams.set("checklists", "all");
  url.searchParams.set("checklist_fields", "name");
  url.searchParams.set("checkItem_fields", "name,state,due,idMember");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch Trello card ${cardId}: ${response.status} ${await response.text()}`,
    );
  }
  const card = (await response.json()) as TrelloApiCard;

  return parseTrelloApiCard(card);
};
