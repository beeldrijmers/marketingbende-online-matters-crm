import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createCheckItem } from "./createCheckItem.ts";
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
  // Twee richtingen op dezelfde koppeling: een stap terugschrijven naar de kaart
  // ("create") en een afvinking doorgeven (de bestaande weg).
  const wantsCreate = body?.action === "create";
  if (taskId == null || (!wantsCreate && typeof complete !== "boolean")) {
    return createErrorResponse(400, "Missing taskId or complete");
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("trello_checkitem_id, deal_id, source, text, due_date")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) {
    console.error("Trello checkitem task lookup failed", taskError.code);
    return createErrorResponse(500, "Taakgegevens konden niet worden geladen.");
  }
  if (!task || task.deal_id == null) {
    return createErrorResponse(422, "Task is not linked to an assignment");
  }
  // Voor het afvinken is niet de herkomst bepalend maar of er een item is om af
  // te vinken: een taak die in Kompas is gemaakt en teruggeschreven naar de kaart
  // heeft source 'manual' en hoort net zo goed mee te lopen.
  if (!wantsCreate && !task.trello_checkitem_id) {
    return createErrorResponse(422, "Task has no Trello checklist item");
  }
  if (wantsCreate && task.trello_checkitem_id) {
    // Al gespiegeld; twee items voor dezelfde taak is erger dan niets doen.
    return new Response(
      JSON.stringify({ ok: true, checkItemId: task.trello_checkitem_id }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("trello_card_id")
    .eq("id", task.deal_id)
    .maybeSingle();
  if (dealError) {
    console.error("Trello checkitem deal lookup failed", dealError.code);
    return createErrorResponse(
      500,
      "Opdrachtgegevens konden niet worden geladen.",
    );
  }
  if (!deal?.trello_card_id) {
    return createErrorResponse(422, "Deal has no linked Trello card");
  }

  if (wantsCreate) {
    const name = (task.text ?? "").trim();
    if (!name) return createErrorResponse(422, "Task has no text");
    try {
      const checkItemId = await createCheckItem({
        cardId: deal.trello_card_id,
        name,
        due: task.due_date,
        apiKey,
        token,
      });
      const { error: linkError } = await supabaseAdmin
        .from("tasks")
        .update({ trello_checkitem_id: checkItemId })
        .eq("id", taskId);
      if (linkError) {
        // Het item staat op de kaart maar het CRM weet het niet: dat is een
        // dubbele-stap-risico bij een volgende poging, dus zeg het.
        console.error("Trello checkitem link failed", linkError.code);
        return createErrorResponse(
          500,
          "De stap staat op de kaart, maar kon niet worden vastgelegd.",
        );
      }
      return new Response(JSON.stringify({ ok: true, checkItemId }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error) {
      console.error(
        "Trello checkitem create failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return createErrorResponse(502, "Trello kon niet worden bijgewerkt.");
    }
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
    console.error(
      "Trello checkitem update failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return createErrorResponse(502, "Trello kon niet worden bijgewerkt.");
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
