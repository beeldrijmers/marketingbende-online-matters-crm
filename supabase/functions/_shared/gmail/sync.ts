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
  listRecentGmailMessageIds,
  refreshGmailAccessToken,
} from "./client.ts";
import { normalizeGmailMessage } from "./messageParser.ts";
import {
  addGmailMessageFailure,
  type GmailMessageFailureKind,
} from "./syncFailure.ts";
import { decryptGmailToken, gmailConnectionAad } from "./tokenCrypto.ts";

export interface GmailConnectionRow {
  id: number;
  sales_id: number;
  email: string;
  refresh_token_encrypted: string;
  history_id: string | null;
}

export interface GmailSyncSummary {
  mode: "full" | "incremental";
  found: number;
  processed: number;
  skipped: number;
  failed: number;
  failureKinds: Partial<Record<GmailMessageFailureKind, number>>;
  remaining: number;
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
    mode: connection.history_id ? "incremental" : "full",
    found: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    failureKinds: {},
    remaining: 0,
    durationMs: 0,
  };

  await supabaseAdmin
    .from("gmail_connections")
    .update({ sync_status: "syncing", last_error: null })
    .eq("id", connection.id);

  try {
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

    let mode: "full" | "incremental" = connection.history_id
      ? "incremental"
      : "full";
    let ids: string[];
    let historyId: string;

    if (connection.history_id) {
      try {
        const history = await listGmailHistoryMessageIds(
          accessToken,
          connection.history_id,
        );
        ids = history.ids;
        historyId = history.historyId;
      } catch (error) {
        // Gmail history ids expire. The official recovery path is a full sync.
        if (!(error instanceof GoogleApiError) || error.status !== 404)
          throw error;
        mode = "full";
        const profile = await getGmailProfile(accessToken);
        historyId = profile.historyId;
        ids = await listRecentGmailMessageIds(accessToken);
      }
    } else {
      // Capture the history boundary BEFORE listing. Messages arriving during
      // the import then remain visible to the next incremental run.
      const profile = await getGmailProfile(accessToken);
      historyId = profile.historyId;
      ids = await listRecentGmailMessageIds(accessToken);
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
        if (
          labels.has("DRAFT") ||
          labels.has("SPAM") ||
          labels.has("TRASH") ||
          labels.has("CATEGORY_PROMOTIONS") ||
          labels.has("CATEGORY_SOCIAL") ||
          labels.has("CATEGORY_FORUMS")
        ) {
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
        });
        if (response.status >= 500) {
          throw new Error(`Inbound processing returned ${response.status}`);
        }
        summary.processed += 1;
      } catch (error) {
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
