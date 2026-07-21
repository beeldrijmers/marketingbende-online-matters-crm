import type { Deal } from "../types";

// Returns a deadline only when a linked deal's canonical CRM deadline truly
// changed. Partial kanban/index updates inherit previousData and therefore do
// not produce accidental Trello writes.
export const getChangedTrelloDeadline = ({
  data,
  previousData,
}: {
  data: Partial<Deal>;
  previousData?: Deal;
}): string | null => {
  if (!previousData?.trello_card_id) return null;

  const previousDeadline = previousData.expected_closing_date ?? null;
  const nextDeadline =
    data.expected_closing_date === undefined
      ? previousDeadline
      : (data.expected_closing_date ?? null);

  if (!nextDeadline || nextDeadline === previousDeadline) return null;
  return nextDeadline.slice(0, 10);
};
