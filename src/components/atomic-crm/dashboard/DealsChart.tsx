import { ResponsiveBar } from "@nivo/bar";
import { format, startOfMonth } from "date-fns";
import { nl } from "date-fns/locale";
import { TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";

import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

const multiplier = {
  "informatie-pipeline": 0.2,
  bezig: 0.5,
  "on-hold": 0.3,
  "facturatie-live": 0.9,
};

const threeMonthsAgo = new Date(
  new Date().setMonth(new Date().getMonth() - 6),
).toISOString();

const DEFAULT_LOCALE = "en-US";

export const DealsChart = memo(() => {
  const translate = useTranslate();
  const { dealStages, currency } = useConfigurationContext();
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];
  const wonLabel = findDealLabel(dealStages, "won") ?? "Gewonnen";
  const lostLabel = findDealLabel(dealStages, "lost");

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 100, page: 1 },
    sort: {
      field: "created_at",
      order: "ASC",
    },
    filter: {
      "created_at@gte": threeMonthsAgo,
    },
  });
  const months = useMemo(() => {
    if (!data) return [];
    const dealsByMonth = data.reduce((acc, deal) => {
      const month = startOfMonth(deal.created_at ?? new Date()).toISOString();
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(deal);
      return acc;
    }, {} as any);

    const amountByMonth = Object.keys(dealsByMonth).map((month) => {
      return {
        date: format(month, "MMM", { locale: nl }),
        won: dealsByMonth[month]
          .filter((deal: Deal) => deal.stage === "won")
          .reduce((acc: number, deal: Deal) => {
            acc += deal.amount ?? 0;
            return acc;
          }, 0),
        pending: dealsByMonth[month]
          .filter((deal: Deal) => !["won", "lost"].includes(deal.stage))
          .reduce((acc: number, deal: Deal) => {
            // @ts-expect-error - multiplier type issue
            acc += (deal.amount ?? 0) * multiplier[deal.stage];
            return acc;
          }, 0),
        lost: dealsByMonth[month]
          .filter((deal: Deal) => deal.stage === "lost")
          .reduce((acc: number, deal: Deal) => {
            acc -= deal.amount ?? 0;
            return acc;
          }, 0),
      };
    });

    return amountByMonth;
  }, [data]);

  if (isPending) return null; // FIXME return skeleton instead
  const range = months.reduce(
    (acc, month) => {
      acc.min = Math.min(acc.min, month.lost);
      acc.max = Math.max(acc.max, month.won + month.pending);
      return acc;
    },
    { min: 0, max: 0 },
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center">
          <div className="mr-3 flex">
            <TrendingUp className="text-muted-foreground w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {translate("crm.dashboard.deals_chart")}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "#61cdbb" }}
            />
            {wonLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: "#97e3d5" }}
            />
            {translate("crm.dashboard.deals_chart_pending", {
              _: "Open (gewogen)",
            })}
          </span>
          {lostLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: "#e25c3b" }}
              />
              {lostLabel}
            </span>
          )}
        </div>
      </div>
      <Card className="p-6">
        <div className="h-[400px]">
          <ResponsiveBar
            data={months}
            indexBy="date"
            keys={["won", "pending", "lost"]}
            colors={["#61cdbb", "#97e3d5", "#e25c3b"]}
            margin={{ top: 10, right: 50, bottom: 30, left: 10 }}
            padding={0.3}
            valueScale={{
              type: "linear",
              min: range.min * 1.2,
              max: range.max * 1.2,
            }}
            indexScale={{ type: "band", round: true }}
            enableGridX={true}
            enableGridY={false}
            enableLabel={false}
            tooltip={({ value, indexValue }) => (
              <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
                <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
                {value.toLocaleString(
                  acceptedLanguages.at(0) ?? DEFAULT_LOCALE,
                  {
                    style: "currency",
                    currency,
                  },
                )}
              </div>
            )}
            axisTop={null}
            axisBottom={{
              legendPosition: "middle",
              legendOffset: 50,
              tickSize: 0,
              tickPadding: 12,
              style: {
                ticks: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
                legend: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
              },
            }}
            axisLeft={null}
            axisRight={{
              format: (v: any) => `${Math.abs(v / 1000)}k`,
              tickValues: 8,
              style: {
                ticks: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
                legend: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
});
