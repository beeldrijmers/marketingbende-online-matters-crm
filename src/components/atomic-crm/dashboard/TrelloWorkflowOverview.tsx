import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Columns3,
  ListChecks,
} from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DealWorkflowIndicator } from "../deals/DealWorkflowIndicator";
import { buildOpenTasksByDeal } from "../deals/dealWorkflow";
import { findDealLabel, formatISODateString } from "../deals/dealUtils";
import { SyncTrelloButton } from "../deals/SyncTrelloButton";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AssigneesField } from "../sales/AssigneesField";
import type { Deal, IntegrationRun, Task } from "../types";
import { formatIntegrationRunDate } from "./integrationStatusModel";
import { buildTrelloBoardSnapshot } from "./trelloBoardModel";

const stageTone: Record<string, { dot: string; column: string }> = {
  "informatie-pipeline": {
    dot: "bg-slate-500",
    column: "border-t-slate-500",
  },
  "bevestigd-inplannen": {
    dot: "bg-blue-500",
    column: "border-t-blue-500",
  },
  "on-hold": { dot: "bg-amber-500", column: "border-t-amber-500" },
  bezig: { dot: "bg-violet-500", column: "border-t-violet-500" },
  "controle-livegang": {
    dot: "bg-cyan-500",
    column: "border-t-cyan-500",
  },
  "facturatie-live": {
    dot: "bg-emerald-500",
    column: "border-t-emerald-500",
  },
  won: { dot: "bg-green-600", column: "border-t-green-600" },
  maandelijks: { dot: "bg-fuchsia-500", column: "border-t-fuchsia-500" },
};

const fallbackTone = { dot: "bg-muted-foreground", column: "border-t-muted" };

const localTodayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const TrelloWorkflowOverview = () => {
  const { dealCategories, dealStages } = useConfigurationContext();
  const {
    data: deals = [],
    error: dealsError,
    isPending: dealsPending,
  } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });
  const { data: tasks = [], isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );
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
  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncTrelloButton />
          <Button asChild size="sm" variant="outline">
            <Link to="/deals">
              Open groot werkbord
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
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
        {dealsPending || tasksPending ? (
          <div className="flex gap-3 overflow-hidden p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-80 min-w-64 rounded-xl" />
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
          <div className="overflow-x-auto bg-muted/20">
            <div className="flex min-w-max items-stretch gap-3 p-3">
              {snapshot.columns.map((column) => (
                <WorkflowColumn
                  key={column.stage.value}
                  deals={column.deals}
                  globalCount={globalCounts?.[column.stage.value]}
                  label={column.stage.label}
                  stage={column.stage.value}
                  categoryLabel={(category) =>
                    findDealLabel(dealCategories, category) ?? category
                  }
                  tasksByDeal={tasksByDeal}
                />
              ))}
            </div>
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

const WorkflowColumn = ({
  categoryLabel,
  deals,
  globalCount,
  label,
  stage,
  tasksByDeal,
}: {
  categoryLabel: (category: string) => string;
  deals: Deal[];
  globalCount?: number;
  label: string;
  stage: string;
  tasksByDeal: Map<Deal["id"], Task[]>;
}) => {
  const tone = stageTone[stage] ?? fallbackTone;
  const differentGlobalCount =
    globalCount != null && globalCount !== deals.length;

  return (
    <div
      className={cn(
        "flex h-[calc(100svh-15rem)] min-h-[30rem] max-h-[58rem] w-64 flex-col rounded-xl border border-t-4 bg-muted/45 shadow-sm",
        tone.column,
      )}
    >
      <div className="flex min-h-14 items-start gap-2 border-b px-3 py-2.5">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot)} />
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5">
          {label}
        </h3>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {differentGlobalCount
            ? `${deals.length}/${globalCount}`
            : deals.length}
        </Badge>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 [scrollbar-gutter:stable]">
        {deals.length > 0 ? (
          deals.map((deal) => (
            <WorkflowCard
              key={deal.id}
              categoryLabel={categoryLabel}
              deal={deal}
              openTasks={tasksByDeal.get(deal.id) ?? []}
            />
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-background/45 px-4 text-center text-xs text-muted-foreground">
            <Columns3 className="size-5 opacity-60" />
            Geen kaarten in deze fase
          </div>
        )}
      </div>
    </div>
  );
};

const WorkflowCard = ({
  categoryLabel,
  deal,
  openTasks,
}: {
  categoryLabel: (category: string) => string;
  deal: Deal;
  openTasks: Task[];
}) => {
  const deadline = formatISODateString(deal.expected_closing_date);
  const overdue =
    deal.expected_closing_date != null &&
    deal.expected_closing_date < localTodayKey() &&
    deal.stage !== "won" &&
    deal.stage !== "on-hold";

  return (
    <Link
      to={`/deals/${deal.id}/show`}
      className="group rounded-lg border bg-card p-2.5 text-card-foreground shadow-sm no-underline transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="line-clamp-3 text-sm font-semibold leading-5 group-hover:text-primary">
        {deal.name}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {deal.category ? (
          <Badge
            variant="secondary"
            className="max-w-full truncate px-1.5 py-0 text-[10px]"
          >
            {categoryLabel(deal.category)}
          </Badge>
        ) : null}
        {deadline ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
              overdue && "font-semibold text-destructive",
            )}
          >
            <CalendarDays className="size-3" />
            {deadline}
          </span>
        ) : null}
        <AssigneesField
          ids={deal.assignee_ids}
          size={16}
          showParties={false}
          className="ml-auto"
        />
      </div>
      <DealWorkflowIndicator deal={deal} openTasks={openTasks} />
    </Link>
  );
};
