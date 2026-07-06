import { ResponsiveBar } from "@nivo/bar";
import {
  format,
  startOfMonth,
  addMonths,
  isAfter,
  isBefore,
  isSameMonth,
} from "date-fns";
import { nl } from "date-fns/locale";
import { Repeat, Coins, LineChart, TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal } from "../types";

// Months of history (including the current one) and months of forecast the
// chart shows. Realized revenue fills the history, the weighted forecast the
// future.
const MONTHS_BACK = 9;
const MONTHS_FORWARD = 4;

const LOST_STAGE = "lost";
const WON_STAGE = "won";

// Probability weight per pipeline stage for the forecast of open (not-yet-won)
// deals - the same philosophy as the "Verwachte deal-omzet" chart.
const STAGE_WEIGHT: Record<string, number> = {
  "informatie-pipeline": 0.2,
  bezig: 0.5,
  "on-hold": 0.3,
  "facturatie-live": 0.9,
};
const weightForStage = (stage: string): number => STAGE_WEIGHT[stage] ?? 0.5;

const RECURRING_COLOR = "#0f8f80";
const ONEOFF_COLOR = "#9bd7cf";
// Forecast bars are rendered with a hatched pattern in this tint so they read
// as "expected, not yet realized" at a glance.
const PROGNOSE_COLOR = "#6f9d97";

const formatEuro = (amount: number, locale: string) =>
  amount.toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Index signature so the array is assignable to nivo's BarDatum[].
interface MonthBucket {
  [key: string]: string | number;
  date: string;
  recurring: number;
  oneoff: number;
  prognose: number;
}

// Attribute a one-off deal to the month it lands: its delivery date, else its
// expected closing date, else when it was created (the Trello card date).
const oneOffMonth = (deal: Deal): Date | null => {
  const raw =
    deal.delivery_date ?? deal.expected_closing_date ?? deal.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildRevenueModel = (deals: Deal[], now: Date) => {
  const currentMonth = startOfMonth(now);
  const active = deals.filter(
    (deal) => !deal.archived_at && deal.stage !== LOST_STAGE && deal.amount,
  );

  const recurring = active.filter((d) => d.revenue_period === "maandelijks");
  const oneoff = active.filter((d) => d.revenue_period === "eenmalig");
  const wonOneoff = oneoff.filter((d) => d.stage === WON_STAGE);
  const openOneoff = oneoff.filter((d) => d.stage !== WON_STAGE);

  // Monthly recurring revenue: every active recurring fee, summed. Projected
  // flat into the future as the recurring part of the forecast.
  const mrr = recurring.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  // The expected close month of an open deal, never earlier than this month
  // (an overdue open deal still shows as "expected now" rather than vanishing).
  const expectedMonth = (deal: Deal): Date => {
    const raw = oneOffMonth(deal) ?? now;
    const month = startOfMonth(raw);
    return isBefore(month, currentMonth) ? currentMonth : month;
  };

  const months: MonthBucket[] = [];
  for (let offset = -(MONTHS_BACK - 1); offset <= MONTHS_FORWARD; offset++) {
    const monthStart = startOfMonth(addMonths(now, offset));
    const isFuture = offset > 0;

    // Realized recurring: a subscription contributes its fee to every month
    // from the month it started up to (and including) the current month.
    const recurringTotal = isFuture
      ? 0
      : recurring.reduce((sum, deal) => {
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

    // Forecast: projected recurring (future months only) plus the stage-weighted
    // value of open one-off deals expected to close this month. Only the current
    // and future months carry a forecast.
    const prognoseRecurring = isFuture ? mrr : 0;
    const prognoseOneoff =
      offset < 0
        ? 0
        : openOneoff.reduce((sum, deal) => {
            return isSameMonth(expectedMonth(deal), monthStart)
              ? sum + (deal.amount ?? 0) * weightForStage(deal.stage)
              : sum;
          }, 0);

    months.push({
      date: format(monthStart, "MMM", { locale: nl }),
      recurring: recurringTotal,
      oneoff: oneoffTotal,
      prognose: Math.round(prognoseRecurring + prognoseOneoff),
    });
  }

  const oneOffThisYear = wonOneoff.reduce((sum, deal) => {
    const month = oneOffMonth(deal);
    return month && month.getFullYear() === now.getFullYear()
      ? sum + (deal.amount ?? 0)
      : sum;
  }, 0);

  // Total stage-weighted value still in the open pipeline (one-off + recurring
  // pipeline deals not yet won), for the forecast tile.
  const openPipeline = active
    .filter((d) => d.stage !== WON_STAGE)
    .reduce((sum, d) => sum + (d.amount ?? 0) * weightForStage(d.stage), 0);

  return {
    months,
    mrr,
    oneOffThisYear,
    openPipeline: Math.round(openPipeline),
  };
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Repeat;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) => (
  <Card className="flex flex-col gap-1 p-5">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4" style={{ color: accent }} />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <span className="text-3xl font-semibold tabular-nums">{value}</span>
    <span className="text-xs text-muted-foreground">{sub}</span>
  </Card>
);

const LegendDot = ({
  color,
  hatched,
  label,
}: {
  color: string;
  hatched?: boolean;
  label: string;
}) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className="size-2.5 rounded-full"
      style={
        hatched
          ? {
              backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 2px, transparent 2px 4px)`,
              border: `1px solid ${color}`,
            }
          : { backgroundColor: color }
      }
    />
    {label}
  </span>
);

export const RevenueDashboard = memo(() => {
  const translate = useTranslate();
  const locale =
    (typeof navigator !== "undefined" && navigator.language) || "nl-NL";

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 1000, page: 1 },
    sort: { field: "created_at", order: "ASC" },
    filter: { "archived_at@is": null },
  });

  const model = useMemo(() => {
    if (!data) return null;
    return buildRevenueModel(data, new Date());
  }, [data]);

  if (isPending || !model) {
    return <Skeleton className="h-[440px] w-full" />;
  }

  const t = (key: string, fallback: string) => translate(key, { _: fallback });
  const seriesLabel = (id: string) =>
    id === "recurring"
      ? t("crm.dashboard.revenue.recurring", "Maandelijks terugkerend")
      : id === "oneoff"
        ? t("crm.dashboard.revenue.oneoff", "Eenmalig")
        : t("crm.dashboard.revenue.forecast", "Prognose (verwacht)");

  const hasData = model.months.some(
    (m) => m.recurring > 0 || m.oneoff > 0 || m.prognose > 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center">
          <TrendingUp className="text-muted-foreground w-6 h-6 mr-3" />
          <h2 className="text-xl font-semibold text-foreground">
            {t("crm.dashboard.revenue.title", "Omzet per maand")}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <LegendDot color={RECURRING_COLOR} label={seriesLabel("recurring")} />
          <LegendDot color={ONEOFF_COLOR} label={seriesLabel("oneoff")} />
          <LegendDot
            color={PROGNOSE_COLOR}
            hatched
            label={seriesLabel("prognose")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={Repeat}
          accent={RECURRING_COLOR}
          label={t(
            "crm.dashboard.revenue.mrr_label",
            "Maandelijks terugkerende omzet",
          )}
          value={formatEuro(model.mrr, locale)}
          sub={t(
            "crm.dashboard.revenue.mrr_sub",
            "per maand, lopende abonnementen",
          )}
        />
        <StatTile
          icon={Coins}
          accent={ONEOFF_COLOR}
          label={t("crm.dashboard.revenue.oneoff_label", "Eenmalige omzet")}
          value={formatEuro(model.oneOffThisYear, locale)}
          sub={t(
            "crm.dashboard.revenue.oneoff_sub",
            "eenmalige projecten dit jaar",
          )}
        />
        <StatTile
          icon={LineChart}
          accent={PROGNOSE_COLOR}
          label={t("crm.dashboard.revenue.forecast_label", "Verwachte omzet")}
          value={formatEuro(model.openPipeline, locale)}
          sub={t("crm.dashboard.revenue.forecast_sub", "gewogen open pijplijn")}
        />
      </div>

      <Card className="p-6">
        <div className="h-[360px]">
          {hasData ? (
            <ResponsiveBar
              data={model.months}
              indexBy="date"
              keys={["recurring", "oneoff", "prognose"]}
              colors={[RECURRING_COLOR, ONEOFF_COLOR, PROGNOSE_COLOR]}
              defs={[
                {
                  id: "prognose-hatch",
                  type: "patternLines",
                  background: "transparent",
                  color: PROGNOSE_COLOR,
                  rotation: -45,
                  lineWidth: 3,
                  spacing: 6,
                },
              ]}
              fill={[{ match: { id: "prognose" }, id: "prognose-hatch" }]}
              margin={{ top: 10, right: 60, bottom: 30, left: 10 }}
              padding={0.35}
              enableGridX={false}
              enableGridY={true}
              enableLabel={false}
              valueScale={{ type: "linear" }}
              indexScale={{ type: "band", round: true }}
              tooltip={({ id, value, indexValue }) => (
                <div className="min-w-48 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {indexValue}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          id === "recurring"
                            ? RECURRING_COLOR
                            : id === "oneoff"
                              ? ONEOFF_COLOR
                              : PROGNOSE_COLOR,
                      }}
                    />
                    <span className="text-muted-foreground">
                      {seriesLabel(String(id))}
                    </span>
                    <span className="ml-auto pl-3 font-semibold tabular-nums">
                      {formatEuro(value, locale)}
                    </span>
                  </div>
                </div>
              )}
              axisBottom={{
                tickSize: 0,
                tickPadding: 12,
              }}
              axisLeft={null}
              axisRight={{
                format: (v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`,
                tickValues: 6,
                tickSize: 0,
              }}
              theme={{
                text: { fill: "var(--color-muted-foreground)" },
                axis: {
                  ticks: { text: { fill: "var(--color-muted-foreground)" } },
                },
                grid: {
                  line: { stroke: "var(--color-border)", strokeWidth: 1 },
                },
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t(
                "crm.dashboard.revenue.empty",
                "Nog geen omzetgegevens. Zet een bedrag en type (maandelijks/eenmalig) op je deals.",
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
});
