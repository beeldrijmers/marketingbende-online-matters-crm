type FetchLike = (
  input: string,
  init?: { method?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

// Trello's documented card update endpoint moves a card when idList changes.
export const writeTrelloCardList = async ({
  cardId,
  listId,
  apiKey,
  token,
  fetchImpl = fetch as unknown as FetchLike,
}: {
  cardId: string;
  listId: string;
  apiKey: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<void> => {
  const url = new URL(`https://api.trello.com/1/cards/${cardId}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("idList", listId);

  const response = await fetchImpl(url.toString(), { method: "PUT" });
  if (!response.ok) {
    throw new Error(
      `Trello card move failed: ${response.status} ${await response.text()}`,
    );
  }
};
