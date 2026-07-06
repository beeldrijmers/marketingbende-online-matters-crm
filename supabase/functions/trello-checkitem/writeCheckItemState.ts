type FetchLike = (
  input: string,
  init?: { method?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

// Writes a checklist item's completion state back to Trello. Extracted from the
// edge-function handler so the request shape stays under test.
export const writeCheckItemState = async ({
  cardId,
  checkItemId,
  complete,
  apiKey,
  token,
  fetchImpl = fetch as unknown as FetchLike,
}: {
  cardId: string;
  checkItemId: string;
  complete: boolean;
  apiKey: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<void> => {
  const url = new URL(
    `https://api.trello.com/1/cards/${cardId}/checkItem/${checkItemId}`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("state", complete ? "complete" : "incomplete");

  const response = await fetchImpl(url.toString(), { method: "PUT" });
  if (!response.ok) {
    throw new Error(
      `Trello checkItem update failed: ${response.status} ${await response.text()}`,
    );
  }
};
