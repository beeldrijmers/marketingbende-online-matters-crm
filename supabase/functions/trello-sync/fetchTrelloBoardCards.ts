import type { TrelloCardInput } from "./trelloCardTypes.ts";
import {
  parseTrelloApiCard,
  type TrelloApiCard,
} from "./parseTrelloApiCard.ts";

// Fetches every card on a board in one call, for the (re-runnable) backfill.
// state "open" is the kanban board itself; "closed" fetches the archived cards
// (used to import their attachments/history without putting them back on the
// board).
export const fetchTrelloBoardCards = async ({
  boardId,
  apiKey,
  token,
  state = "open",
}: {
  boardId: string;
  apiKey: string;
  token: string;
  state?: "open" | "closed";
}): Promise<TrelloCardInput[]> => {
  const url = new URL(
    `https://api.trello.com/1/boards/${boardId}/cards/${state}`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set(
    "fields",
    "name,idList,due,dueComplete,closed,shortUrl,desc,labels",
  );
  url.searchParams.set("attachments", "true");
  url.searchParams.set(
    "attachment_fields",
    "url,name,isUpload,mimeType,bytes,date,fileName",
  );
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
