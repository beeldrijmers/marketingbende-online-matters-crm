import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { resolveTrelloListForDealStage } from "../trello-sync/trelloListMaps.ts";
import { writeTrelloCardList } from "./writeTrelloCardList.ts";

const apiKey = Deno.env.get("TRELLO_API_KEY");
const token = Deno.env.get("TRELLO_TOKEN");

const handler = async (req: Request, userId?: string): Promise<Response> => {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }
  if (!apiKey || !token) {
    return createErrorResponse(500, "Trello credentials are not configured");
  }

  const body = await req.json().catch(() => null);
  const dealId = body?.dealId;
  const stage = body?.stage;
  if (dealId == null || typeof stage !== "string") {
    return createErrorResponse(400, "Missing dealId or stage");
  }
  if (!userId) return createErrorResponse(401, "Unauthorized");

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("user_id", userId)
    .eq("disabled", false)
    .maybeSingle();
  if (saleError) return createErrorResponse(500, saleError.message);
  if (!sale) return createErrorResponse(403, "CRM user is not active");

  // Match the normal deal RLS rule before using service_role data: callers may
  // only write back cards for deals assigned to them.
  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("trello_card_id, category")
    .eq("id", dealId)
    .contains("assignee_ids", [sale.id])
    .maybeSingle();
  if (dealError) return createErrorResponse(500, dealError.message);
  if (!deal) return createErrorResponse(404, "Deal not found");
  if (!deal.trello_card_id) {
    return createErrorResponse(422, "Deal has no linked Trello card");
  }

  const listId = resolveTrelloListForDealStage({
    stage,
    category: deal.category,
  });
  if (!listId) {
    return createErrorResponse(422, `Stage ${stage} has no Trello list`);
  }

  try {
    await writeTrelloCardList({
      cardId: deal.trello_card_id,
      listId,
      apiKey,
      token,
    });
  } catch (error) {
    return createErrorResponse(502, (error as Error).message);
  }

  return new Response(JSON.stringify({ ok: true, listId }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, (req, user) => handler(req, user?.id)),
    ),
  ),
);
