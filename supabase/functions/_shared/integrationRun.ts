import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * De gezondheidsregel van een koppeling: wanneer draaide hij, hoeveel deed hij,
 * en ging er iets mis.
 *
 * Bewust best-effort: een probleem met het wegschrijven van de statusregel mag
 * nooit het werk zelf tegenhouden. Monitoring die de zaak stillegt is erger dan
 * geen monitoring.
 */

export type IntegrationRunKind = "manual" | "backfill" | "scheduled";
export type IntegrationRunStatus = "success" | "partial" | "failed";

export const startIntegrationRun = async ({
  integration,
  runKind,
  startedAt,
}: {
  integration: string;
  runKind: IntegrationRunKind;
  startedAt: number;
}): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from("integration_runs")
    .insert({
      integration,
      run_kind: runKind,
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      `Could not start ${integration} integration run:`,
      error.code,
    );
    return null;
  }
  return Number(data.id);
};

export const finishIntegrationRun = async ({
  runId,
  status,
  durationMs,
  itemsProcessed,
  failedCount,
  summary,
  error: runError,
}: {
  runId: number | null;
  status: IntegrationRunStatus;
  durationMs: number;
  itemsProcessed: number;
  failedCount: number;
  summary: Record<string, unknown>;
  error?: string | null;
}): Promise<void> => {
  if (runId == null) return;

  const { error } = await supabaseAdmin
    .from("integration_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      items_processed: itemsProcessed,
      failed_count: failedCount,
      summary,
      error: runError ?? null,
    })
    .eq("id", runId);

  if (error) {
    console.error("Could not finish integration run:", error.code);
  }
};
