import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { useGetList } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { SyncTrelloButton } from "../deals/SyncTrelloButton";
import { formatTrelloSyncDuration } from "../deals/trelloSyncNotification";
import type { IntegrationRun } from "../types";
import {
  formatIntegrationRunDate,
  getIntegrationHealth,
  type IntegrationHealth,
} from "./integrationStatusModel";

const stageLabels = [
  ["informatie-pipeline", "Open"],
  ["bevestigd-inplannen", "Bevestigd"],
  ["on-hold", "Wacht"],
  ["bezig", "Bezig"],
  ["controle-livegang", "Controle"],
  ["facturatie-live", "Factureren"],
  ["won", "Afgerond"],
  ["maandelijks", "Maand"],
] as const;

export const IntegrationStatus = () => {
  const {
    data = [],
    isPending,
    error,
  } = useGetList<IntegrationRun>(
    "integration_runs",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "started_at", order: "DESC" },
      filter: {},
    },
    { refetchInterval: 30_000 },
  );
  const trelloRun = data.find(
    (candidate) => candidate.integration === "trello",
  );
  const gmailRun = data.find((candidate) => candidate.integration === "gmail");

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link2 className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">Koppelingen</h2>
          <p className="text-xs text-muted-foreground">
            Live status van Gmail, Trello en de laatste volledige controles
          </p>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold">Status niet beschikbaar</p>
              <p className="text-xs text-muted-foreground">
                De synchronisatiehistorie kon niet worden geladen.
              </p>
            </div>
          </div>
        ) : trelloRun || gmailRun ? (
          <div className="divide-y">
            {trelloRun ? <RunDetails run={trelloRun} label="Trello" /> : null}
            {gmailRun ? <RunDetails run={gmailRun} label="Gmail" /> : null}
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Nog niet gecontroleerd</p>
              <p className="text-xs text-muted-foreground">
                Start een volledige synchronisatie om de status vast te leggen.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Statussen en stappen lopen in CRM en Trello beide kanten op.
          </p>
          <SyncTrelloButton />
        </div>
      </Card>
    </section>
  );
};

const RunDetails = ({ run, label }: { run: IntegrationRun; label: string }) => {
  const health = getIntegrationHealth(run);
  const counts = run.summary?.stageCounts;
  const timestamp = run.finished_at ?? run.started_at;

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <StatusIcon health={health} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{label}</p>
            <StatusBadge health={health} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {health.description}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatIntegrationRunDate(timestamp)}
            {run.duration_ms != null
              ? ` · ${formatTrelloSyncDuration(run.duration_ms)}`
              : ""}
          </p>
        </div>
      </div>

      {counts ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {stageLabels.map(([key, label]) => (
            <div
              key={key}
              className="min-w-0 rounded-md border bg-muted/30 px-1.5 py-1.5 text-center"
            >
              <span className="block truncate text-[10px] text-muted-foreground">
                {label}
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {counts[key]}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {run.error && run.status !== "success" ? (
        <p className="mt-3 line-clamp-2 rounded-md bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          {run.error}
        </p>
      ) : null}
    </div>
  );
};

const StatusIcon = ({ health }: { health: IntegrationHealth }) => {
  const Icon =
    health.tone === "success"
      ? CheckCircle2
      : health.tone === "danger"
        ? XCircle
        : health.tone === "running"
          ? LoaderCircle
          : AlertTriangle;
  return (
    <Icon
      className={cn(
        "mt-0.5 size-5 shrink-0",
        health.tone === "success" && "text-emerald-600",
        health.tone === "warning" && "text-amber-500",
        health.tone === "danger" && "text-destructive",
        health.tone === "running" && "animate-spin text-blue-600",
      )}
    />
  );
};

const StatusBadge = ({ health }: { health: IntegrationHealth }) => (
  <Badge
    variant="outline"
    className={cn(
      health.tone === "success" &&
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      health.tone === "warning" &&
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      health.tone === "danger" &&
        "border-destructive/30 bg-destructive/10 text-destructive",
      health.tone === "running" &&
        "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    )}
  >
    {health.label}
  </Badge>
);
