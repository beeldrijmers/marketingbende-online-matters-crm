import type { Identifier } from "ra-core";

import type { Deal } from "../types";

/**
 * When a client is owed an update — in this team's rhythm, not on a timer.
 *
 * Updates go out at two moments: when a project is finished, and at the monthly
 * close for recurring SEO work. An earlier version of this list nagged after two
 * weeks of silence and skipped finished work entirely, which had it exactly
 * backwards: a project in progress is not news, and delivery is.
 *
 * Pure: `now` comes from the caller.
 */

const DAY_MS = 86_400_000;

/** Inside this many days of month end, the closing update is due for THIS month. */
const MONTH_CLOSE_WINDOW_DAYS = 5;

const MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export type UpdateReason =
  /** Work is done and ready to invoice: the client should hear it from us. */
  | "project_klaar"
  /** The assignment is closed off. */
  | "project_afgerond"
  /** Recurring work: the month has to be reported. */
  | "maandafsluiting";

export type UpdateMoment = {
  companyId: Identifier | null;
  dealId: Identifier;
  dealName: string;
  reason: UpdateReason;
  /** Which month a monthly update covers, e.g. "juni". */
  monthLabel?: string;
  /** How long this moment has been waiting, in days; null when unknown. */
  daysWaiting: number | null;
  stage: string;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const daysUntilMonthEnd = (now: Date): number => {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.ceil((endOfMonth.getTime() - now.getTime()) / DAY_MS);
};

const isRecurring = (deal: Deal) =>
  deal.revenue_period === "maandelijks" || deal.stage === "maandelijks";

/** "Klaar / te factureren" and "Afgerond" are the two finish lines. */
const FINISHED_STAGES: Record<string, UpdateReason> = {
  "facturatie-live": "project_klaar",
  won: "project_afgerond",
};

const daysBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

export const selectUpdateMoments = (
  deals: Deal[],
  now: Date = new Date(),
): UpdateMoment[] => {
  const monthStart = startOfMonth(now);
  const closingThisMonth = daysUntilMonthEnd(now) <= MONTH_CLOSE_WINDOW_DAYS;

  const moments = deals.flatMap<UpdateMoment>((deal) => {
    if (deal.archived_at != null) return [];
    const lastUpdate = parseDate(deal.client_updated_at);
    const base = {
      companyId: deal.company_id ?? null,
      dealId: deal.id,
      dealName: deal.name,
      stage: deal.stage,
    };

    // Recurring work is reported per month, so a finished cycle is not a
    // finished project: it is checked against the month, below.
    if (!isRecurring(deal)) {
      const reason = FINISHED_STAGES[deal.stage];
      if (!reason) return [];

      // The moment the work actually finished. won_notified_at is stamped when
      // the card reaches "Klaar"; updated_at is the fallback for CRM-native work.
      const finishedAt =
        parseDate(deal.won_notified_at) ?? parseDate(deal.updated_at);
      const told =
        lastUpdate != null &&
        finishedAt != null &&
        lastUpdate.getTime() >= finishedAt.getTime();
      if (told) return [];

      return [
        {
          ...base,
          reason,
          daysWaiting: finishedAt ? daysBetween(finishedAt, now) : null,
        },
      ];
    }

    // Monthly work: due as long as this month holds no update. Which month it
    // covers depends on where we are: inside the closing window it is this
    // month, otherwise the month that already ended without a word.
    const reportedThisMonth =
      lastUpdate != null && lastUpdate.getTime() >= monthStart.getTime();
    if (reportedThisMonth) return [];

    const covered = closingThisMonth
      ? now
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);

    return [
      {
        ...base,
        reason: "maandafsluiting",
        monthLabel: MONTHS[covered.getMonth()],
        daysWaiting: closingThisMonth ? 0 : daysBetween(monthStart, now),
      },
    ];
  });

  // Finished work first: the client is waiting on the result, and an invoice
  // usually follows it. Within a group, the longest wait leads.
  const rank: Record<UpdateReason, number> = {
    project_klaar: 0,
    project_afgerond: 1,
    maandafsluiting: 2,
  };
  return moments.sort((left, right) => {
    if (rank[left.reason] !== rank[right.reason]) {
      return rank[left.reason] - rank[right.reason];
    }
    return (right.daysWaiting ?? 0) - (left.daysWaiting ?? 0);
  });
};
