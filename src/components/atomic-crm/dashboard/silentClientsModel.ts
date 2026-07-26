import type { Identifier } from "ra-core";

import type { Deal } from "../types";

/**
 * Which clients have been left in the dark.
 *
 * A board answers "what is the state of this work". It cannot answer the
 * question a client actually asks, which is "why have I not heard anything" —
 * and that is the one that costs goodwill. Every open deal carries the date it
 * was last explained to the client (or no date at all), so the silence is
 * measurable, and a screen can hand it back as work.
 *
 * Pure: `now` comes from the caller.
 */

/** Two weeks of silence on live work is where a client starts to wonder. */
export const SILENCE_THRESHOLD_DAYS = 14;

const DAY_MS = 86_400_000;

/** Work that is finished no longer owes anyone an update. */
const isLive = (deal: Deal) =>
  deal.archived_at == null && deal.stage !== "won" && deal.stage !== "lost";

export type SilentClientRow = {
  companyId: Identifier | null;
  dealId: Identifier;
  dealName: string;
  /** null when the client was never told anything about this work. */
  daysSilent: number | null;
  stage: string;
};

export const selectSilentClients = (
  deals: Deal[],
  now: Date = new Date(),
  thresholdDays: number = SILENCE_THRESHOLD_DAYS,
): SilentClientRow[] => {
  const rows = deals.filter(isLive).flatMap((deal) => {
    const lastUpdate = deal.client_updated_at
      ? new Date(deal.client_updated_at)
      : null;
    const daysSilent =
      lastUpdate && !Number.isNaN(lastUpdate.getTime())
        ? Math.floor((now.getTime() - lastUpdate.getTime()) / DAY_MS)
        : null;

    // Never told beats "told a while ago": both need doing, but one of them the
    // client has been guessing about from the start.
    if (daysSilent != null && daysSilent < thresholdDays) return [];

    // Work that started this week owes nobody a progress report yet. Without
    // this the list would open with every assignment in the CRM on the day the
    // feature ships, and a list that is always full is a list nobody reads.
    if (daysSilent == null) {
      const started = new Date(deal.created_at);
      const age = Number.isNaN(started.getTime())
        ? Number.POSITIVE_INFINITY
        : Math.floor((now.getTime() - started.getTime()) / DAY_MS);
      if (age < thresholdDays) return [];
    }

    return [
      {
        companyId: deal.company_id ?? null,
        daysSilent,
        dealId: deal.id,
        dealName: deal.name,
        stage: deal.stage,
      },
    ];
  });

  return rows.sort((left, right) => {
    if (left.daysSilent == null && right.daysSilent == null) return 0;
    if (left.daysSilent == null) return -1;
    if (right.daysSilent == null) return 1;
    return right.daysSilent - left.daysSilent;
  });
};
