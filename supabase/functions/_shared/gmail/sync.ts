import {
  claimInboundEmail,
  processInboundEmail,
} from "../inbound/processInboundEmail.ts";
import { supabaseAdmin } from "../supabaseAdmin.ts";
import { gmailInboundEmailId, selectGmailSyncBatch } from "./batch.ts";
import {
  getGmailAttachmentData,
  getGmailMessage,
  getGmailProfile,
  GoogleApiError,
  listGmailHistoryMessageIds,
  refreshGmailAccessToken,
} from "./client.ts";
import { normalizeGmailMessage } from "./messageParser.ts";
import {
  addGmailMessageFailure,
  type GmailMessageFailureKind,
  isUnavailableGmailMessage,
} from "./syncFailure.ts";
import { decryptGmailToken, gmailConnectionAad } from "./tokenCrypto.ts";

export interface GmailConnectionRow {
  id: number;
  sales_id: number;
  email: string;
  refresh_token_encrypted: string;
  history_id: string | null;
  sync_label_id: string | null;
  sync_label_name: string | null;
  sync_status?: "connected" | "syncing" | "error" | "needs_label";
}

export interface GmailSyncSummary {
  mode: "boundary_reset" | "incremental";
  found: number;
  processed: number;
  skipped: number;
  failed: number;
  failureKinds: Partial<Record<GmailMessageFailureKind, number>>;
  remaining: number;
  /** Messages Gmail no longer exposes, skipped without retrying forever. */
  unavailable: number;
  durationMs: number;
}

// Leave enough headroom for status updates before the hosted function timeout.
const GMAIL_SYNC_TIME_BUDGET_MS = 90_000;

const startRun = async (
  runKind: "manual" | "scheduled",
  startedAt: number,
): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from("integration_runs")
    .insert({
      integration: "gmail",
      run_kind: runKind,
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("Could not start Gmail integration run:", error.message);
    return null;
  }
  return Number(data.id);
};

const finishRun = async (
  runId: number | null,
  summary: GmailSyncSummary,
  errorMessage?: string,
): Promise<void> => {
  if (runId == null) return;
  const { error } = await supabaseAdmin
    .from("integration_runs")
    .update({
      status: errorMessage
        ? "failed"
        : summary.failed > 0 || summary.remaining > 0
          ? "partial"
          : "success",
      finished_at: new Date().toISOString(),
      duration_ms: summary.durationMs,
      items_processed: summary.processed,
      failed_count: summary.failed,
      summary,
      error: errorMessage ?? null,
    })
    .eq("id", runId);
  if (error)
    console.error("Could not finish Gmail integration run:", error.message);
};

export const syncGmailConnection = async ({
  connection,
  ownerSalesEmail,
  runKind,
}: {
  connection: GmailConnectionRow;
  ownerSalesEmail: string;
  runKind: "manual" | "scheduled";
}): Promise<GmailSyncSummary> => {
  const startedAt = Date.now();
  const runId = await startRun(runKind, startedAt);
  const blankSummary: GmailSyncSummary = {
    mode: connection.history_id ? "incremental" : "boundary_reset",
    found: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    failureKinds: {},
    remaining: 0,
    unavailable: 0,
    durationMs: 0,
  };

  await supabaseAdmin
    .from("gmail_connections")
    .update({ sync_status: "syncing", last_error: null })
    .eq("id", connection.id);

  try {
    const syncLabelId = connection.sync_label_id;
    if (!syncLabelId) {
      throw new Error("Kies eerst een Gmail-label voor CRM-import");
    }
    const encKey = Deno.env.get("GMAIL_ENC_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!encKey || !clientId || !clientSecret) {
      throw new Error("Gmail synchronization secrets are not configured");
    }

    const refreshToken = await decryptGmailToken(
      connection.refresh_token_encrypted,
      encKey,
      gmailConnectionAad(connection.sales_id),
    );
    const accessToken = await refreshGmailAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    });

    let mode: GmailSyncSummary["mode"] = connection.history_id
      ? "incremental"
      : "boundary_reset";
    let ids: string[];
    let historyId: string;

    if (connection.history_id) {
      try {
        const history = await listGmailHistoryMessageIds(
          accessToken,
          connection.history_id,
          syncLabelId,
        );
        ids = history.ids;
        historyId = history.historyId;
      } catch (error) {
        // Gmail history ids expire. Rather than backfilling older labelled
        // mail, reset the boundary: the CRM only imports mail deliberately
        // labelled after activation.
        if (!(error instanceof GoogleApiError) || error.status !== 404)
          throw error;
        mode = "boundary_reset";
        const profile = await getGmailProfile(accessToken);
        historyId = profile.historyId;
        ids = [];
      }
    } else {
      // A connection should normally receive a history id when its label is
      // selected. If it does not, set a fresh boundary instead of importing
      // earlier labelled mail.
      const profile = await getGmailProfile(accessToken);
      historyId = profile.historyId;
      ids = [];
    }

    const emailIds = ids.map((messageId) =>
      gmailInboundEmailId(connection.sales_id, messageId),
    );
    let claimedRows: { email_id: string }[] = [];
    if (emailIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("inbound_email_events")
        .select("email_id")
        .in("email_id", emailIds);
      if (error) throw error;
      claimedRows = (data ?? []).map((row) => ({
        email_id: String(row.email_id),
      }));
    }

    const batch = selectGmailSyncBatch({
      messageIds: ids,
      claimedEmailIds: new Set(claimedRows.map((row) => row.email_id)),
      salesId: connection.sales_id,
    });
    const summary: GmailSyncSummary = {
      mode,
      found: ids.length,
      processed: 0,
      skipped: batch.alreadyHandled,
      failed: 0,
      failureKinds: {},
      remaining: batch.remaining,
      unavailable: 0,
      durationMs: 0,
    };

    for (const [index, messageId] of batch.messageIds.entries()) {
      if (Date.now() - startedAt >= GMAIL_SYNC_TIME_BUDGET_MS) {
        summary.remaining += batch.messageIds.length - index;
        break;
      }
      try {
        const message = await getGmailMessage(accessToken, messageId);
        const labels = new Set(message.labelIds ?? []);
        // The selected CRM label is the only consent boundary. Do not claim a
        // mail that was unlabelled before we fetched it: reapplying the label
        // later should still create a Gmail labelAdded history event.
        if (!labels.has(syncLabelId)) {
          summary.skipped += 1;
          continue;
        }
        if (labels.has("DRAFT") || labels.has("SPAM") || labels.has("TRASH")) {
          await claimInboundEmail(
            gmailInboundEmailId(connection.sales_id, messageId),
          );
          summary.skipped += 1;
          continue;
        }
        const normalized = await normalizeGmailMessage(
          message,
          (attachmentId) =>
            getGmailAttachmentData(accessToken, messageId, attachmentId),
        );
        const response = await processInboundEmail({
          emailId: gmailInboundEmailId(connection.sales_id, messageId),
          email: normalized,
          ownerSalesId: connection.sales_id,
          ownerSalesEmail,
          mailboxEmail: connection.email,
          inboundEmail: Deno.env.get("VITE_INBOUND_EMAIL") ?? "",
          source: "gmail",
        });
        if (response.status >= 500) {
          throw new Error(`Inbound processing returned ${response.status}`);
        }
        summary.processed += 1;
      } catch (error) {
        // Incremental Gmail history can mention a message that was deleted or
        // moved before we fetched it. It cannot be recovered through the API,
        // so claim it to prevent a permanent cursor-blocking retry loop.
        if (isUnavailableGmailMessage(error)) {
          await claimInboundEmail(
            gmailInboundEmailId(connection.sales_id, messageId),
          );
          summary.skipped += 1;
          summary.unavailable += 1;
          console.warn("Gmail message no longer available; skipped safely");
          continue;
        }
        summary.failed += 1;
        const failureKind = addGmailMessageFailure(summary.failureKinds, error);
        console.error(`Gmail message processing failed (${failureKind})`);
      }
    }

    // Do not advance past failed messages. Successful ones are idempotently
    // claimed, so the next retry safely revisits the same history range.
    if (summary.failed === 0) {
      const connectionUpdate: Record<string, string | null> = {
        sync_status: "connected",
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      };
      if (summary.remaining === 0) connectionUpdate.history_id = historyId;
      const { error: connectionUpdateError } = await supabaseAdmin
        .from("gmail_connections")
        .update(connectionUpdate)
        .eq("id", connection.id);
      if (connectionUpdateError) throw connectionUpdateError;
    } else {
      const { error: connectionUpdateError } = await supabaseAdmin
        .from("gmail_connections")
        .update({
          sync_status: "error",
          last_error: `${summary.failed} bericht(en) konden niet worden verwerkt`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
      if (connectionUpdateError) throw connectionUpdateError;
    }

    summary.durationMs = Date.now() - startedAt;
    await finishRun(runId, summary);
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const summary = {
      ...blankSummary,
      failed: 1,
      durationMs: Date.now() - startedAt,
    };
    await supabaseAdmin
      .from("gmail_connections")
      .update({
        sync_status: "error",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    await finishRun(runId, summary, message);
    throw error;
  }
};
