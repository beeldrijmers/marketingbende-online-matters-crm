import { ResponsiveBar } from "@nivo/bar";
import { AlertTriangle } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";
import { Link } from "react-router";
import { BOARD_PATH } from "../deals/dashboardDealSelection";

import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "../layout/SectionHeader";
import type { Deal } from "../types";
import { buildRevenueModel } from "./revenueModel";

// The chart reads from the palette rather than its own teals, so it follows the
// light/dark switch and sits in the same colour family as the rest of the app.
const RECURRING_COLOR = "var(--series-1)";
const ONEOFF_COLOR = "var(--series-3)";
// Forecast bars are hatched in a quieter tint so they read as "expected, not
// yet realised" at a glance.
const PROGNOSE_COLOR = "var(--ink-3)";

// Currency is always rendered with Dutch (nl-NL) conventions to stay
// consistent with the deal cards, pipeline and column totals across the app.
const formatEuro = (amount: number) =>
  amount.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const StatTile = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) => (
  <div className="panel flex flex-col gap-0.5 p-4">
    <span className="eyebrow flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
      {label}
    </span>
    <span className="num text-figure text-ink">{value}</span>
    <span className="text-meta text-ink-3">{sub}</span>
  </div>
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
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <SectionHeader
          className="min-w-0 flex-1"
          title={t("crm.dashboard.revenue.title", "Omzet per maand")}
        />
        <div className="flex items-center gap-3 text-meta text-ink-3">
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
          accent={RECURRING_COLOR}
          label={t(
            "crm.dashboard.revenue.mrr_label",
            "Maandelijks terugkerende omzet",
          )}
          value={formatEuro(model.mrr)}
          sub={t(
            "crm.dashboard.revenue.mrr_sub",
            "per maand, lopende abonnementen",
          )}
        />
        <StatTile
          accent={ONEOFF_COLOR}
          label={t("crm.dashboard.revenue.oneoff_label", "Eenmalige omzet")}
          value={formatEuro(model.oneOffThisYear)}
          sub={t(
            "crm.dashboard.revenue.oneoff_sub",
            "eenmalige projecten dit jaar",
          )}
        />
        <StatTile
          accent={PROGNOSE_COLOR}
          label={t("crm.dashboard.revenue.forecast_label", "Verwachte omzet")}
          value={formatEuro(model.openPipeline)}
          sub={t(
            "crm.dashboard.revenue.forecast_sub",
            "geplande open deals, gewogen naar fase",
          )}
        />
      </div>

      {model.unplannedDealCount > 0 ? (
        <Link
          to={BOARD_PATH}
          className="flex items-start gap-3 rounded-lg border border-wait/35 bg-wait-tint px-4 py-3 text-body no-underline"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-wait" />
          <span className="min-w-0 flex-1 text-ink">
            <strong className="num font-semibold">
              {model.unplannedDealCount} opdrachten zonder planning
            </strong>
            <span className="block text-meta text-ink-2">
              {formatEuro(model.unplannedPipeline)} verwachte omzet staat in
              geen enkele maand. Voeg een verwachte opleverdatum toe.
            </span>
          </span>
        </Link>
      ) : null}

      <div className="panel p-4">
        <div className="h-[340px]">
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
                <div className="min-w-48 rounded-md border border-line bg-popover px-3 py-2 text-popover-foreground shadow-e2">
                  <p className="eyebrow mb-1.5">{indexValue}</p>
                  <div className="flex items-center gap-2 text-body">
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
                    <span className="text-ink-2">
                      {seriesLabel(String(id))}
                    </span>
                    <span className="num ml-auto pl-3 font-semibold">
                      {formatEuro(value)}
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
                text: { fill: "var(--ink-3)" },
                axis: {
                  ticks: { text: { fill: "var(--ink-3)" } },
                },
                grid: {
                  line: { stroke: "var(--line-subtle)", strokeWidth: 1 },
                },
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-body text-ink-3">
              {t(
                "crm.dashboard.revenue.empty",
                "Nog geen omzetgegevens. Zet een bedrag en type (maandelijks of eenmalig) op uw opdrachten.",
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
