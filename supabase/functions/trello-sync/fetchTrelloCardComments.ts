interface TrelloCommentAction {
  date: string;
  memberCreator: { fullName: string };
  data: { text: string };
}

export interface TrelloComment {
  date: string;
  authorName: string;
  text: string;
}

// Fetches every comment on a card in chronological order, for the one-time
// backfill (the live webhook already receives each comment as its own event).
export const fetchTrelloCardComments = async ({
  cardId,
  apiKey,
  token,
}: {
  cardId: string;
  apiKey: string;
  token: string;
}): Promise<TrelloComment[]> => {
  const url = new URL(`https://api.trello.com/1/cards/${cardId}/actions`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("filter", "commentCard");
  url.searchParams.set("fields", "type,date,data");
  url.searchParams.set("memberCreator_fields", "fullName");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch comments for card ${cardId}: ${response.status} ${await response.text()}`,
    );
  }
  const actions = (await response.json()) as TrelloCommentAction[];

  return actions
    .map((action) => ({
      date: action.date,
      authorName: action.memberCreator?.fullName ?? "Onbekend",
      text: action.data.text,
    }))
    .reverse(); // Trello returns newest first; we want chronological order.
};
