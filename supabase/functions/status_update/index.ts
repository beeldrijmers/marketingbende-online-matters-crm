import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isValidStatusToken } from "./token.ts";

/**
 * The client's side of a shared status update.
 *
 * Runs without a session on purpose: a client should be able to open a link and
 * read where their project stands, without an account and without the CRM
 * exposing anything else. The token in the URL is the entire credential, so:
 *
 *   - a malformed token is rejected before touching the database;
 *   - exactly one row is resolved, by token, and only the fields that were
 *     written to be read by the client are returned (never the deal, never an
 *     amount, never an internal note);
 *   - a revoked link answers 410, so "this is no longer current" is a different
 *     answer from "this never existed".
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ??
    (req.method === "POST"
      ? ((await req.json().catch(() => null))?.token ?? null)
      : null);

  if (typeof token !== "string" || !isValidStatusToken(token)) {
    return createErrorResponse(404, "Deze link bestaat niet (meer).");
  }

  const { data, error } = await supabaseAdmin
    .from("deal_status_updates")
    .select(
      "id, title, body, sections, company_name, sender_name, shared_at, revoked_at, view_count",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("status_update lookup failed:", error.message);
    return createErrorResponse(500, "De update kon niet worden geladen.");
  }
  if (!data) {
    return createErrorResponse(404, "Deze link bestaat niet (meer).");
  }
  if (data.revoked_at) {
    return createErrorResponse(410, "Deze link is niet meer geldig.");
  }

  // Counting a view is bookkeeping, never a reason to fail the read: the client
  // came for the text. Two simultaneous opens can cost one count; that is a fine
  // price for keeping this a single statement instead of a transaction.
  const { error: viewError } = await supabaseAdmin
    .from("deal_status_updates")
    .update({
      view_count: (data.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (viewError) {
    console.error("status_update view bookkeeping failed:", viewError.message);
  }

  return new Response(
    JSON.stringify({
      title: data.title,
      body: data.body,
      sections: data.sections ?? [],
      companyName: data.company_name,
      senderName: data.sender_name,
      sharedAt: data.shared_at,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
      status: 200,
    },
  );
};

Deno.serve((req) => OptionsMiddleware(req, handler));
