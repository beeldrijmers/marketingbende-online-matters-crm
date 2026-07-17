interface TrelloCommentAction {
  id: string;
  date: string;
  memberCreator: { fullName: string };
  data: { text: string };
}

export interface TrelloComment {
  id: string;
  date: string;
  authorName: string;
  text: string;
}

// Trello's maximum page size for the actions endpoint. Without an explicit
// limit Trello silently returns only the 50 newest actions, which made cards
// with long histories lose their oldest comments during backfill.
const PAGE_SIZE = 1000;

// Fetches every comment on a card in chronological order, for the one-time
// backfill (the live webhook already receives each comment as its own event).
// Pages backwards through the card's history until a short page signals the
// end, so no comment count can outgrow the import.
export const fetchTrelloCardComments = async ({
  cardId,
  apiKey,
  token,
}: {
  cardId: string;
  apiKey: string;
  token: string;
}): Promise<TrelloComment[]> => {
  const actions: TrelloCommentAction[] = [];
  let before: string | undefined;

  while (true) {
    const url = new URL(`https://api.trello.com/1/cards/${cardId}/actions`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("token", token);
    url.searchParams.set("filter", "commentCard");
    url.searchParams.set("fields", "id,type,date,data");
    url.searchParams.set("memberCreator_fields", "fullName");
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (before) {
      url.searchParams.set("before", before);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Could not fetch comments for card ${cardId}: ${response.status} ${await response.text()}`,
      );
    }
    const page = (await response.json()) as TrelloCommentAction[];
    actions.push(...page);

    if (page.length < PAGE_SIZE) break;
    // Trello returns newest first; the last item of the page is the oldest,
    // and `before` continues from there.
    before = page[page.length - 1].id;
  }

  return actions
    .map((action) => ({
      id: action.id,
      date: action.date,
      authorName: action.memberCreator?.fullName ?? "Onbekend",
      text: action.data.text,
    }))
    .reverse(); // Trello returns newest first; we want chronological order.
};
