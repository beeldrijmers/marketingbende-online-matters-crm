// Gmail synchronizer: authenticated users can sync their own mailbox; the
// scheduled workflow can reconcile every connected mailbox with a dedicated
// secret header.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  type GmailConnectionRow,
  type GmailSyncSummary,
  syncGmailConnection,
} from "../_shared/gmail/sync.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type ScheduledSyncResult = {
  salesId: number;
  ok: boolean;
  error?: "owner_missing" | "message_processing_failed" | "sync_failed";
  summary?: GmailSyncSummary;
};

const selectConnection = async (
  salesId: number,
): Promise<GmailConnectionRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("gmail_connections")
    .select("id, sales_id, email, refresh_token_encrypted, history_id")
    .eq("sales_id", salesId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as GmailConnectionRow | null;
};

const handleOwnSync = async (req: Request): Promise<Response> =>
  AuthMiddleware(req, async (req) =>
    UserMiddleware(req, async (_req, user) => {
      const sale = await getUserSale(user!);
      if (!sale) return createErrorResponse(401, "Unauthorized");
      const connection = await selectConnection(sale.id);
      if (!connection) {
        return createErrorResponse(404, "Koppel eerst een Gmail-account.");
      }
      try {
        const summary = await syncGmailConnection({
          connection,
          ownerSalesEmail: sale.email,
          runKind: "manual",
        });
        return jsonResponse({ data: summary });
      } catch (error) {
        console.error("Manual Gmail sync failed:", error);
        return createErrorResponse(
          502,
          "Gmail synchroniseren is mislukt. Probeer het later opnieuw.",
        );
      }
    }),
  );

const handleScheduledSync = async (): Promise<Response> => {
  const { data, error } = await supabaseAdmin
    .from("gmail_connections")
    .select("id, sales_id, email, refresh_token_encrypted, history_id");
  if (error) return jsonResponse({ error: error.message }, 500);

  const results: ScheduledSyncResult[] = [];
  for (const row of (data ?? []) as GmailConnectionRow[]) {
    const { data: sale } = await supabaseAdmin
      .from("sales")
      .select("email")
      .eq("id", row.sales_id)
      .maybeSingle();
    if (!sale?.email) {
      results.push({
        salesId: row.sales_id,
        ok: false,
        error: "owner_missing",
      });
      continue;
    }
    try {
      const summary = await syncGmailConnection({
        connection: row,
        ownerSalesEmail: sale.email,
        runKind: "scheduled",
      });
      const hasMessageFailures = summary.failed > 0;
      results.push({
        salesId: row.sales_id,
        ok: !hasMessageFailures,
        ...(hasMessageFailures && { error: "message_processing_failed" }),
        summary,
      });
    } catch {
      results.push({ salesId: row.sales_id, ok: false, error: "sync_failed" });
    }
  }
  const failed = results.filter((result) => !result.ok).length;
  const messageFailures = results.reduce(
    (total, result) => total + (result.summary?.failed ?? 0),
    0,
  );
  return jsonResponse(
    { data: { connections: results.length, failed, messageFailures, results } },
    failed > 0 ? 207 : 200,
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST")
    return createErrorResponse(405, "Method Not Allowed");

  const scheduledSecret = Deno.env.get("GMAIL_SYNC_SECRET");
  if (
    scheduledSecret &&
    req.headers.get("x-gmail-sync-secret") === scheduledSecret
  ) {
    return handleScheduledSync();
  }
  return OptionsMiddleware(req, handleOwnSync);
});
