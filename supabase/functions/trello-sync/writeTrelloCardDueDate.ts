type FetchLike = (
  input: string,
  init?: { method?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

// Trello stores a due date as a timestamp. Use 17:00 Dutch summer time
// (15:00Z), matching the existing monthly cards and avoiding a date shift in
// either Trello or the CRM date-only fields.
export const trelloDueTimestamp = (deadline: string): string =>
  `${deadline}T15:00:00.000Z`;

export const writeTrelloCardDueDate = async ({
  cardId,
  deadline,
  apiKey,
  token,
  fetchImpl = fetch as unknown as FetchLike,
}: {
  cardId: string;
  deadline: string;
  apiKey: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<void> => {
  const url = new URL(`https://api.trello.com/1/cards/${cardId}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("due", trelloDueTimestamp(deadline));

  const response = await fetchImpl(url.toString(), { method: "PUT" });
  if (!response.ok) {
    throw new Error(
      `Trello deadline update failed: ${response.status} ${await response.text()}`,
    );
  }
};
