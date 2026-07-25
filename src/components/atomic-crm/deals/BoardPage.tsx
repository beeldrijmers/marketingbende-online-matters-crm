import { AlertTriangle, ListChecks, Radar } from "lucide-react";
import { ResourceContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { formatIntegrationRunDate } from "../dashboard/integrationStatusModel";
import { PageHeader } from "../layout/PageHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, IntegrationRun } from "../types";
import { AttentionDealsDashboard } from "./DashboardDealKanbanPage";
import { BOARD_PATH } from "./dashboardDealSelection";
import { DealList } from "./DealList";
import { getDealDashboardRedirectPath } from "./dealDashboardRedirectPath";

export type BoardFocus = "all" | "attention";

const focusViews: {
  value: BoardFocus;
  labelKey: string;
  fallback: string;
  icon: typeof Radar;
}[] = [
  {
    value: "all",
    labelKey: "resources.deals.board.focus_all",
    fallback: "Alles",
    icon: ListChecks,
  },
  {
    value: "attention",
    labelKey: "resources.deals.board.focus_attention",
    fallback: "Aandacht",
    icon: Radar,
  },
];

const parseFocus = (value: string | null): BoardFocus =>
  value === "attention" ? value : "all";

/**
 * The board is the app's workspace, so it is a page — not a tab inside a tab.
 *
 * Chrome above the first card is down to two rows: identity plus the focus
 * switch, then the list's own filter row. Everything else (stage totals, the
 * "search, filter, drag" instruction, the summary badge strip) either moved
 * into the column headers where it belongs or was noise.
 */
export const BoardPage = () => {
  const location = useLocation();

  // The resource's list route is a catch-all, so historic deep links such as
  // /deals/12/show land here; translate them into the board's dialog params.
  if (location.pathname !== BOARD_PATH) {
    return (
      <Navigate
        to={getDealDashboardRedirectPath(
          location.pathname,
          location.search,
          BOARD_PATH,
        )}
        replace
      />
    );
  }

  return <Board />;
};

/** The board itself, without the route guard — also used by stories/tests. */
export const Board = () => {
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = parseFocus(searchParams.get("focus"));

  const {
    data: deals = [],
    error: dealsError,
    isPending: dealsPending,
  } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });
  const { data: runs = [] } = useGetList<IntegrationRun>(
    "integration_runs",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "started_at", order: "DESC" },
      filter: {},
    },
    { refetchInterval: 30_000 },
  );

  // Count what is actually on the board. The old header counted Trello-linked
  // cards only, so CRM-native deals were invisible in the total (and an empty
  // Trello history reported "0 opdrachten" above a full board).
  const unmapped = useMemo(() => {
    const known = new Set(dealStages.map((stage) => stage.value));
    return deals.filter((deal) => !known.has(deal.stage));
  }, [dealStages, deals]);
  const latestRun = runs.find((run) => run.integration === "trello");
  const recurringTotal = useMemo(
    () =>
      deals
        .filter((deal) => deal.revenue_period === "maandelijks")
        .reduce((total, deal) => total + (deal.amount ?? 0), 0),
    [deals],
  );

  const setFocus = (nextFocus: BoardFocus) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextFocus === "all") next.delete("focus");
        else next.set("focus", nextFocus);
        // Leaving a focus closes whatever dialog it had opened.
        for (const param of ["deal", "edit", "new", "filter", "q"]) {
          next.delete(param);
        }
        return next;
      },
      { replace: true },
    );
  };

  const meta = dealsPending
    ? null
    : [
        translate("resources.deals.board.count", {
          smart_count: deals.length,
          _: `${deals.length} opdrachten`,
        }),
        recurringTotal > 0
          ? translate("resources.deals.board.recurring_total", {
              amount: formatCompactEuro(recurringTotal),
              _: `${formatCompactEuro(recurringTotal)} per maand`,
            })
          : null,
        latestRun
          ? translate("resources.deals.board.last_sync", {
              moment: formatIntegrationRunDate(
                latestRun.finished_at ?? latestRun.started_at,
              ),
              _: `bijgewerkt ${formatIntegrationRunDate(latestRun.finished_at ?? latestRun.started_at)}`,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={translate("resources.deals.name", {
          smart_count: 2,
          _: "Opdrachten",
        })}
        meta={meta}
        actions={
          <div
            role="group"
            aria-label={translate("resources.deals.board.focus_label", {
              _: "Weergave van het bord",
            })}
            className="flex items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5"
          >
            {focusViews.map(({ fallback, icon: Icon, labelKey, value }) => (
              <button
                key={value}
                type="button"
                aria-pressed={focus === value}
                onClick={() => setFocus(value)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-meta font-medium transition-colors duration-1",
                  focus === value
                    ? "bg-raised text-ink shadow-e1"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {translate(labelKey, { _: fallback })}
              </button>
            ))}
          </div>
        }
      />

      {dealsError ? (
        <div className="panel flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-late" />
          <div>
            <p className="text-section">
              {translate("resources.deals.board.error_title", {
                _: "Bord niet beschikbaar",
              })}
            </p>
            <p className="text-body text-ink-2">
              {translate("resources.deals.board.error_body", {
                _: "De opdrachten konden niet worden geladen. Probeer de pagina opnieuw te laden.",
              })}
            </p>
          </div>
        </div>
      ) : dealsPending ? (
        <BoardSkeleton />
      ) : (
        <ResourceContextProvider value="deals">
          {focus === "attention" ? (
            <AttentionDealsDashboard />
          ) : (
            <DealList detailBasePath={BOARD_PATH} embedded />
          )}
        </ResourceContextProvider>
      )}

      {unmapped.length > 0 ? (
        <p className="mt-2 flex shrink-0 items-center gap-1.5 text-meta text-late">
          <AlertTriangle className="size-3.5" />
          {translate("resources.deals.board.unmapped", {
            smart_count: unmapped.length,
            _: `${unmapped.length} opdracht(en) hebben een onbekende fase en staan daarom in geen enkele kolom.`,
          })}
        </p>
      ) : null}
    </div>
  );
};

const formatCompactEuro = (amount: number) =>
  amount.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 1,
  });

const BoardSkeleton = () => (
  <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
    {Array.from({ length: 6 }).map((_, index) => (
      <Skeleton key={index} className="h-full w-64 shrink-0 rounded-lg" />
    ))}
  </div>
);
