import type { TrelloCardInput } from "./trelloCardTypes.ts";
import { parseTrelloApiCard, type TrelloApiCard } from "./parseTrelloApiCard.ts";

// Fetches every open card on a board in one call, for the one-time backfill.
export const fetchTrelloBoardCards = async ({
  boardId,
  apiKey,
  token,
}: {
  boardId: string;
  apiKey: string;
  token: string;
}): Promise<TrelloCardInput[]> => {
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards/open`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set(
    "fields",
    "name,idList,due,dueComplete,shortUrl,desc,labels",
  );
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
      `Could not fetch cards for board ${boardId}: ${response.status} ${await response.text()}`,
    );
  }
  const cards = (await response.json()) as TrelloApiCard[];

  return cards.map(parseTrelloApiCard);
};
