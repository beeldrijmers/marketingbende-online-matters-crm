import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { writeCheckItemState } from "./writeCheckItemState.ts";

const apiKey = Deno.env.get("TRELLO_API_KEY");
const token = Deno.env.get("TRELLO_TOKEN");

// Writes a CRM step completion back to its Trello checklist item, keeping the
// two in sync. Authenticated: only signed-in CRM users can call it. The Trello
// webhook echo that follows is a no-op (the CRM row already matches), so there
// is no sync loop.
const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }
  if (!apiKey || !token) {
    return createErrorResponse(500, "Trello credentials are not configured");
  }

  const body = await req.json().catch(() => null);
  const taskId = body?.taskId;
  const complete = body?.complete;
  if (taskId == null || typeof complete !== "boolean") {
    return createErrorResponse(400, "Missing taskId or complete");
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("trello_checkitem_id, deal_id, source")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) {
    return createErrorResponse(500, taskError.message);
  }
  if (
    !task ||
    task.source !== "trello" ||
    !task.trello_checkitem_id ||
    task.deal_id == null
  ) {
    return createErrorResponse(422, "Task is not a Trello-synced step");
  }

  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("trello_card_id")
    .eq("id", task.deal_id)
    .maybeSingle();
  if (dealError) {
    return createErrorResponse(500, dealError.message);
  }
  if (!deal?.trello_card_id) {
    return createErrorResponse(422, "Deal has no linked Trello card");
  }

  try {
    await writeCheckItemState({
      cardId: deal.trello_card_id,
      checkItemId: task.trello_checkitem_id,
      complete,
      apiKey,
      token,
    });
  } catch (error) {
    return createErrorResponse(502, (error as Error).message);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) => UserMiddleware(req, () => handler(req))),
  ),
);
