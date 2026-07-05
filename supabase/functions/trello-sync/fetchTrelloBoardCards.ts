import type { TrelloCardInput } from "./trelloCardTypes.ts";

interface TrelloApiCard {
  id: string;
  name: string;
  idList: string;
  due: string | null;
  dueComplete: boolean;
  shortUrl: string;
  desc: string;
  labels: { name: string }[];
  attachments?: { url: string; name: string }[];
}

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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch cards for board ${boardId}: ${response.status} ${await response.text()}`,
    );
  }
  const cards = (await response.json()) as TrelloApiCard[];

  return cards.map((card) => ({
    id: card.id,
    name: card.name,
    idList: card.idList,
    labelNames: card.labels.map((label) => label.name),
    due: card.due,
    dueComplete: card.dueComplete,
    url: card.shortUrl,
    desc: card.desc ?? "",
    attachmentUrls: (card.attachments ?? [])
      .map((attachment) => attachment.url)
      .filter(Boolean),
  }));
};
