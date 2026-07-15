import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export type TrelloRunKind = "manual" | "backfill" | "scheduled";

interface TrelloRunSummary {
  synced: number;
  failed: Array<{ cardId: string; cardName: string; error: string }>;
  durationMs: number;
}

// Monitoring is deliberately best-effort: a temporary problem writing the
// health row must never prevent the actual Trello synchronization from running.
export const startTrelloIntegrationRun = async ({
  runKind,
  startedAt,
}: {
  runKind: TrelloRunKind;
  startedAt: number;
}): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from("integration_runs")
    .insert({
      integration: "trello",
      run_kind: runKind,
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Could not start Trello integration run:", error.message);
    return null;
  }
  return Number(data.id);
};

export const completeTrelloIntegrationRun = async (
  runId: number | null,
  summary: TrelloRunSummary,
): Promise<void> => {
  if (runId == null) return;

  const firstFailure = summary.failed[0]?.error ?? null;
  const { error } = await supabaseAdmin
    .from("integration_runs")
    .update({
      status: summary.failed.length > 0 ? "partial" : "success",
      finished_at: new Date().toISOString(),
      duration_ms: summary.durationMs,
      items_processed: summary.synced,
      failed_count: summary.failed.length,
      summary,
      error: firstFailure,
    })
    .eq("id", runId);

  if (error) {
    console.error("Could not finish Trello integration run:", error.message);
  }
};

export const failTrelloIntegrationRun = async ({
  runId,
  startedAt,
  error: runError,
}: {
  runId: number | null;
  startedAt: number;
  error: unknown;
}): Promise<void> => {
  if (runId == null) return;

  const message =
    runError instanceof Error ? runError.message : String(runError);
  const { error } = await supabaseAdmin
    .from("integration_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      failed_count: 1,
      error: message,
    })
    .eq("id", runId);

  if (error) {
    console.error("Could not fail Trello integration run:", error.message);
  }
};
