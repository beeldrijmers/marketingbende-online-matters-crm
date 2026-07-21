import type { TrelloCardInput } from "./trelloCardTypes.ts";
import {
  trelloDueTimestamp,
  writeTrelloCardDueDate,
} from "./writeTrelloCardDueDate.ts";

const WORK_TIME_ZONE = "Europe/Amsterdam";

export const endOfWorkMonth = (now: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find(({ type }) => type === "year")?.value);
  const month = Number(parts.find(({ type }) => type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

// Give every operational card a concrete deadline. Existing deliberate dates
// always win; only missing dates default to the final day of the current work
// month. The returned in-memory card immediately carries the same value, so
// the current sync writes it to CRM without waiting for Trello's echo webhook.
export const ensureTrelloCardDeadline = async ({
  card,
  apiKey,
  token,
  now,
  writeDeadline = writeTrelloCardDueDate,
}: {
  card: TrelloCardInput;
  apiKey: string;
  token: string;
  now?: Date;
  writeDeadline?: typeof writeTrelloCardDueDate;
}): Promise<TrelloCardInput> => {
  if (card.due) return card;

  const deadline = endOfWorkMonth(now);
  await writeDeadline({ cardId: card.id, deadline, apiKey, token });
  return { ...card, due: trelloDueTimestamp(deadline) };
};
