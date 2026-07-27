import {
  finishIntegrationRun,
  type IntegrationRunKind,
  startIntegrationRun,
} from "../_shared/integrationRun.ts";

export type TrelloRunKind = IntegrationRunKind;

interface TrelloRunSummary {
  synced: number;
  failed: Array<{ cardId: string; cardName: string; error: string }>;
  durationMs: number;
}

// Monitoring is deliberately best-effort: a temporary problem writing the
// health row must never prevent the actual Trello synchronization from running.
export const startTrelloIntegrationRun = ({
  runKind,
  startedAt,
}: {
  runKind: TrelloRunKind;
  startedAt: number;
}): Promise<number | null> =>
  startIntegrationRun({ integration: "trello", runKind, startedAt });

export const completeTrelloIntegrationRun = (
  runId: number | null,
  summary: TrelloRunSummary,
): Promise<void> =>
  finishIntegrationRun({
    runId,
    status: summary.failed.length > 0 ? "partial" : "success",
    durationMs: summary.durationMs,
    itemsProcessed: summary.synced,
    failedCount: summary.failed.length,
    summary,
    error: summary.failed[0]?.error ?? null,
  });

export const failTrelloIntegrationRun = ({
  runId,
  startedAt,
  error,
}: {
  runId: number | null;
  startedAt: number;
  error: unknown;
}): Promise<void> =>
  finishIntegrationRun({
    runId,
    status: "failed",
    durationMs: Date.now() - startedAt,
    itemsProcessed: 0,
    failedCount: 1,
    summary: {},
    error: error instanceof Error ? error.message : String(error),
  });
