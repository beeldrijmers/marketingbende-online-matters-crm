import {
  addMonths,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { nl } from "date-fns/locale";

import type { Deal } from "../types";

// Months of history (including the current one) and months of forecast the
// chart shows. Realized revenue fills the history, the weighted forecast the
// future.
export const MONTHS_BACK = 9;
export const MONTHS_FORWARD = 4;

const LOST_STAGE = "lost";
const WON_STAGE = "won";

// Stages in which a deal is actually being invoiced. A recurring deal only
// counts as a running subscription (MRR / realized revenue) once it reaches
// one of these stages; before that it is open pipeline and belongs to the
// forecast instead.
const REALIZED_RECURRING_STAGES = ["facturatie-live", WON_STAGE];

// Probability weight per pipeline stage for the forecast of open (not-yet-won)
// deals - the same philosophy as the "Verwachte deal-omzet" chart.
const STAGE_WEIGHT: Record<string, number> = {
  "informatie-pipeline": 0.2,
  bezig: 0.5,
  "on-hold": 0.3,
  "facturatie-live": 0.9,
};
const weightForStage = (stage: string): number => STAGE_WEIGHT[stage] ?? 0.5;

// Index signature so the array is assignable to nivo's BarDatum[].
export interface MonthBucket {
  [key: string]: string | number;
  date: string;
  recurring: number;
  oneoff: number;
  prognose: number;
}

export interface RevenueModel {
  months: MonthBucket[];
  mrr: number;
  oneOffThisYear: number;
  openPipeline: number;
}

// A deal is recurring only when explicitly marked as monthly. A deal without
// a revenue_period is treated as one-off everywhere (tiles, bars and
// forecast), so it stays visible instead of silently disappearing from some
// of the numbers.
const isRecurringDeal = (deal: Deal): boolean =>
  deal.revenue_period === "maandelijks";

// Attribute a one-off deal to the month it lands: its delivery date, else its
// expected closing date, else when it was created (the Trello card date).
const oneOffMonth = (deal: Deal): Date | null => {
  const raw =
    deal.delivery_date ?? deal.expected_closing_date ?? deal.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const buildRevenueModel = (deals: Deal[], now: Date): RevenueModel => {
  const currentMonth = startOfMonth(now);
  const lastForecastMonth = startOfMonth(addMonths(now, MONTHS_FORWARD));
  const active = deals.filter(
    (deal) => !deal.archived_at && deal.stage !== LOST_STAGE && deal.amount,
  );

  const recurring = active.filter(isRecurringDeal);
  const oneoff = active.filter((deal) => !isRecurringDeal(deal));

  // Realized revenue only counts deals that are actually invoiced: running
  // (live/won) subscriptions and won one-off projects. Deals still in the
  // Nieuw/Bezig/In de wacht stages are forecast, not realized.
  const liveRecurring = recurring.filter((deal) =>
    REALIZED_RECURRING_STAGES.includes(deal.stage),
  );
  const wonOneoff = oneoff.filter((deal) => deal.stage === WON_STAGE);

  // Open pipeline: every active deal that is not realized yet. This single
  // population feeds both the "Verwachte omzet" tile and the hatched forecast
  // bars, so the tile and the chart always tell the same story.
  const openDeals = active.filter((deal) =>
    isRecurringDeal(deal)
      ? !REALIZED_RECURRING_STAGES.includes(deal.stage)
      : deal.stage !== WON_STAGE,
  );

  // Monthly recurring revenue: every running subscription fee, summed.
  // Projected flat into the future as the recurring part of the forecast.
  const mrr = liveRecurring.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  // The expected close month of an open deal, clamped into the visible
  // forecast window: an overdue open deal shows as "expected now" and a deal
  // expected after the window lands in the last forecast month, so no open
  // deal vanishes from the bars and their sum matches the forecast tile
  // (plus the projected MRR).
  const expectedMonth = (deal: Deal): Date => {
    const raw = oneOffMonth(deal) ?? now;
    const month = startOfMonth(raw);
    if (isBefore(month, currentMonth)) return currentMonth;
    if (isAfter(month, lastForecastMonth)) return lastForecastMonth;
    return month;
  };

  const months: MonthBucket[] = [];
  for (let offset = -(MONTHS_BACK - 1); offset <= MONTHS_FORWARD; offset++) {
    const monthStart = startOfMonth(addMonths(now, offset));
    const isFuture = offset > 0;

    // Realized recurring: a running subscription contributes its fee to every
    // month from the month it started up to (and including) the current month.
    const recurringTotal = isFuture
      ? 0
      : liveRecurring.reduce((sum, deal) => {
          const start = startOfMonth(new Date(deal.created_at));
          const started =
            !isAfter(start, monthStart) || isSameMonth(start, monthStart);
          return started ? sum + (deal.amount ?? 0) : sum;
        }, 0);

    // Realized one-off: a won project's full fee lands in its delivery month.
    const oneoffTotal = isFuture
      ? 0
      : wonOneoff.reduce((sum, deal) => {
          const month = oneOffMonth(deal);
          return month && isSameMonth(startOfMonth(month), monthStart)
            ? sum + (deal.amount ?? 0)
            : sum;
        }, 0);

    // Forecast: projected MRR (future months only) plus the stage-weighted
    // value of open deals expected to close this month. Only the current and
    // future months carry a forecast.
    const prognoseRecurring = isFuture ? mrr : 0;
    const prognoseOpen =
      offset < 0
        ? 0
        : openDeals.reduce((sum, deal) => {
            return isSameMonth(expectedMonth(deal), monthStart)
              ? sum + (deal.amount ?? 0) * weightForStage(deal.stage)
              : sum;
          }, 0);

    months.push({
      date: format(monthStart, "MMM", { locale: nl }),
      recurring: recurringTotal,
      oneoff: oneoffTotal,
      prognose: Math.round(prognoseRecurring + prognoseOpen),
    });
  }

  const oneOffThisYear = wonOneoff.reduce((sum, deal) => {
    const month = oneOffMonth(deal);
    return month && month.getFullYear() === now.getFullYear()
      ? sum + (deal.amount ?? 0)
      : sum;
  }, 0);

  // Total stage-weighted value of the open pipeline, for the forecast tile.
  // Same population and weights as the forecast bars above.
  const openPipeline = openDeals.reduce(
    (sum, deal) => sum + (deal.amount ?? 0) * weightForStage(deal.stage),
    0,
  );

  return {
    months,
    mrr,
    oneOffThisYear,
    openPipeline: Math.round(openPipeline),
  };
};
