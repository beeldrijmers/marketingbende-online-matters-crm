import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { useGetList } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { SyncTrelloButton } from "../deals/SyncTrelloButton";
import { formatTrelloSyncDuration } from "../deals/trelloSyncNotification";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { IntegrationRun } from "../types";
import {
  formatIntegrationRunDate,
  getIntegrationHealth,
  type IntegrationHealth,
} from "./integrationStatusModel";

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
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className="panel overflow-hidden">
        {isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 size-4 shrink-0 text-late" />
            <div>
              <p className="text-body font-medium text-ink">
                Status niet beschikbaar
              </p>
              <p className="text-meta text-ink-3">
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
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-wait" />
            <div>
              <p className="text-body font-medium text-ink">
                Nog niet gecontroleerd
              </p>
              <p className="text-meta text-ink-3">
                Start een volledige synchronisatie om de status vast te leggen.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line-subtle bg-sunken p-3">
          <p className="text-meta text-ink-3">
            Statussen en stappen lopen in CRM en Trello beide kanten op.
          </p>
          <SyncTrelloButton />
        </div>
      </div>
    </section>
  );
};

const RunDetails = ({ run, label }: { run: IntegrationRun; label: string }) => {
  const { dealStages } = useConfigurationContext();
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
          {dealStages.map((stage) => (
            <div
              key={stage.value}
              className="min-w-0 rounded-md border border-line-subtle bg-sunken px-1.5 py-1.5 text-center"
              title={stage.label}
            >
              <span className="block truncate text-eyebrow tracking-normal text-ink-3">
                {stage.shortLabel ?? stage.label}
              </span>
              <span className="num block text-body font-semibold">
                {(counts as Record<string, number>)[stage.value] ?? 0}
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
        health.tone === "success" && "text-live",
        health.tone === "warning" && "text-wait",
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
      health.tone === "success" && "border-live/30 bg-live-tint text-live ",
      health.tone === "warning" && "border-wait/35 bg-wait-tint text-wait",
      health.tone === "danger" &&
        "border-destructive/30 bg-destructive/10 text-destructive",
      health.tone === "running" &&
        "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    )}
  >
    {health.label}
  </Badge>
);
