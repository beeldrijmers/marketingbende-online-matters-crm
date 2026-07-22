import {
  AlertTriangle,
  CircleDollarSign,
  ListChecks,
  Radar,
} from "lucide-react";
import { ResourceContextProvider, useGetList } from "ra-core";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  AttentionDealsDashboard,
  BillingDealsDashboard,
} from "../deals/DashboardDealKanbanPage";
import { DealList } from "../deals/DealList";
import { DASHBOARD_WORKBOARD_PATH } from "../deals/dashboardDealSelection";
import { SyncTrelloButton } from "../deals/SyncTrelloButton";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, IntegrationRun } from "../types";
import { formatIntegrationRunDate } from "./integrationStatusModel";
import { buildTrelloBoardSnapshot } from "./trelloBoardModel";

type WorkboardFocus = "all" | "attention" | "billing";

const workboardViews = [
  { value: "all", label: "Alle opdrachten", icon: ListChecks },
  { value: "attention", label: "Aandacht nodig", icon: Radar },
  { value: "billing", label: "Facturatie", icon: CircleDollarSign },
] as const;

export const TrelloWorkflowOverview = ({
  mobile = false,
}: {
  mobile?: boolean;
}) => {
  const { dealStages } = useConfigurationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  const focus: WorkboardFocus =
    requestedFocus === "attention" || requestedFocus === "billing"
      ? requestedFocus
      : "all";
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

  const snapshot = useMemo(
    () => buildTrelloBoardSnapshot(deals, dealStages),
    [dealStages, deals],
  );
  const latestRun = runs.find((run) => run.integration === "trello");
  const globalCounts: Record<string, number> | undefined = latestRun?.summary
    ?.stageCounts
    ? { ...latestRun.summary.stageCounts }
    : undefined;
  const globalTotal = globalCounts
    ? dealStages.reduce(
        (total, stage) => total + (globalCounts[stage.value] ?? 0),
        0,
      )
    : snapshot.total;
  const ignoredCount = latestRun?.summary?.ignored ?? 0;
  const boardFullyVisible = snapshot.total === globalTotal;
  const summaryCounts: Record<string, number> =
    globalCounts ??
    Object.fromEntries(
      snapshot.columns.map((column) => [
        column.stage.value,
        column.deals.length,
      ]),
    );
  const inProgress = [
    "informatie-pipeline",
    "bevestigd-inplannen",
    "on-hold",
    "bezig",
    "controle-livegang",
  ].reduce((total, stage) => total + (summaryCounts[stage] ?? 0), 0);

  const setFocus = (nextFocus: WorkboardFocus) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextFocus === "all") next.delete("focus");
        else next.set("focus", nextFocus);
        next.delete("deal");
        next.delete("edit");
        next.delete("new");
        next.delete("filter");
        next.delete("q");
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
          <ListChecks className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            Opdrachtenbord · van begin tot eind
          </h2>
          <p className="text-xs text-muted-foreground">
            {boardFullyVisible
              ? `${globalTotal} operationele opdrachten in acht duidelijke werkfasen.`
              : `${snapshot.total} van ${globalTotal} opdrachten zichtbaar; de rest is aan andere teamleden toegewezen.`}
            {latestRun
              ? ` Laatste controle ${formatIntegrationRunDate(latestRun.finished_at ?? latestRun.started_at)}.`
              : ""}
          </p>
        </div>
        <SyncTrelloButton />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <BoardSummaryBadge label="In werkstroom" value={inProgress} />
        <BoardSummaryBadge
          label="Te factureren"
          value={summaryCounts["facturatie-live"] ?? 0}
        />
        <BoardSummaryBadge label="Afgerond" value={summaryCounts.won ?? 0} />
        <BoardSummaryBadge
          label="Vaste klanten"
          value={summaryCounts.maandelijks ?? 0}
        />
        {ignoredCount > 0 ? (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            90 · Naslag/templates · {ignoredCount}
          </Badge>
        ) : null}
      </div>

      <Card className="overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 p-3">
          <div
            role="group"
            aria-label="Weergave van het opdrachtenbord"
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-card p-1"
          >
            {workboardViews.map(({ icon: Icon, label, value }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={focus === value ? "default" : "ghost"}
                aria-pressed={focus === value}
                className="shrink-0"
                onClick={() => setFocus(value)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Zoek, filter, versleep, bewerk en plan rechtstreeks vanuit dit bord.
          </p>
        </div>

        {dealsPending ? (
          <div className="flex gap-3 overflow-hidden p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-96 min-w-72 rounded-xl" />
            ))}
          </div>
        ) : dealsError ? (
          <div className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold">Werkbord niet beschikbaar</p>
              <p className="text-sm text-muted-foreground">
                De CRM-kaarten konden niet worden geladen. Probeer de pagina
                opnieuw.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 bg-muted/10 p-3">
            {focus === "attention" ? (
              <AttentionDealsDashboard mobile={mobile} />
            ) : focus === "billing" ? (
              <BillingDealsDashboard mobile={mobile} />
            ) : (
              <ResourceContextProvider value="deals">
                <DealList detailBasePath={DASHBOARD_WORKBOARD_PATH} embedded />
              </ResourceContextProvider>
            )}
          </div>
        )}
      </Card>

      {snapshot.unmapped.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          {snapshot.unmapped.length} Trello-kaart(en) hebben een onbekende
          CRM-fase en staan daarom nog niet in een kolom.
        </p>
      ) : null}
    </section>
  );
};

const BoardSummaryBadge = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <Badge variant="secondary" className="gap-1 font-normal">
    {label}
    <span className="font-semibold tabular-nums">{value}</span>
  </Badge>
);
