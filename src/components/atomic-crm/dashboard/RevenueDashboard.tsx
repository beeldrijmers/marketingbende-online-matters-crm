import { ResponsiveBar } from "@nivo/bar";
import { Repeat, Coins, LineChart, TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal } from "../types";
import { buildRevenueModel } from "./revenueModel";

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
          sub={t(
            "crm.dashboard.revenue.forecast_sub",
            "open deals, gewogen naar fase",
          )}
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
