import { ResponsiveBar } from "@nivo/bar";
import {
  format,
  startOfMonth,
  subMonths,
  isAfter,
  isSameMonth,
} from "date-fns";
import { nl } from "date-fns/locale";
import { Repeat, Coins, TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal } from "../types";

// How many months of history the bar chart shows (including the current one).
const MONTHS_BACK = 12;

// Stage of a deal that means it's dead: it never counts as revenue.
const LOST_STAGE = "lost";

const RECURRING_COLOR = "#0f8f80";
const ONEOFF_COLOR = "#9bd7cf";

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
  const active = deals.filter(
    (deal) => !deal.archived_at && deal.stage !== LOST_STAGE && deal.amount,
  );

  const recurring = active.filter((d) => d.revenue_period === "maandelijks");
  const oneoff = active.filter((d) => d.revenue_period === "eenmalig");

  // Current monthly recurring revenue: every active recurring fee, summed.
  const mrr = recurring.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  // The 12 month buckets, oldest first.
  const months: MonthBucket[] = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));

    // Recurring: a subscription contributes its monthly fee to every month
    // from the month it started (card creation) up to now.
    const recurringTotal = recurring.reduce((sum, deal) => {
      const start = startOfMonth(new Date(deal.created_at));
      const startsOnOrBefore =
        !isAfter(start, monthStart) || isSameMonth(start, monthStart);
      return startsOnOrBefore ? sum + (deal.amount ?? 0) : sum;
    }, 0);

    // One-off: the full fee lands in its delivery/close/creation month.
    const oneoffTotal = oneoff.reduce((sum, deal) => {
      const month = oneOffMonth(deal);
      return month && isSameMonth(startOfMonth(month), monthStart)
        ? sum + (deal.amount ?? 0)
        : sum;
    }, 0);

    months.push({
      date: format(monthStart, "MMM", { locale: nl }),
      recurring: recurringTotal,
      oneoff: oneoffTotal,
    });
  }

  const oneOffThisYear = oneoff.reduce((sum, deal) => {
    const month = oneOffMonth(deal);
    return month && month.getFullYear() === now.getFullYear()
      ? sum + (deal.amount ?? 0)
      : sum;
  }, 0);

  return { months, mrr, oneOffThisYear };
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
    return <Skeleton className="h-[420px] w-full" />;
  }

  const t = (key: string, fallback: string) => translate(key, { _: fallback });

  const hasData = model.months.some((m) => m.recurring > 0 || m.oneoff > 0);

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
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: RECURRING_COLOR }}
            />
            {t("crm.dashboard.revenue.recurring", "Maandelijks terugkerend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: ONEOFF_COLOR }}
            />
            {t("crm.dashboard.revenue.oneoff", "Eenmalig")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatTile
          icon={Repeat}
          accent={RECURRING_COLOR}
          label={t(
            "crm.dashboard.revenue.mrr_label",
            "Maandelijks terugkerende omzet",
          )}
          value={`${formatEuro(model.mrr, locale)}`}
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
      </div>

      <Card className="p-6">
        <div className="h-[360px]">
          {hasData ? (
            <ResponsiveBar
              data={model.months}
              indexBy="date"
              keys={["recurring", "oneoff"]}
              colors={[RECURRING_COLOR, ONEOFF_COLOR]}
              margin={{ top: 10, right: 60, bottom: 30, left: 10 }}
              padding={0.35}
              enableGridX={false}
              enableGridY={true}
              enableLabel={false}
              valueScale={{ type: "linear" }}
              indexScale={{ type: "band", round: true }}
              tooltip={({ id, value, color, indexValue }) => (
                <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {indexValue}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground">
                      {id === "recurring"
                        ? t(
                            "crm.dashboard.revenue.recurring",
                            "Maandelijks terugkerend",
                          )
                        : t("crm.dashboard.revenue.oneoff", "Eenmalig")}
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
