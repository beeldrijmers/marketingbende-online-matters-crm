import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { resolveTrelloListForDealStage } from "../trello-sync/trelloListMaps.ts";
import { writeTrelloCardDueDate } from "../trello-sync/writeTrelloCardDueDate.ts";
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
  const deadline = body?.deadline;
  const hasStage = typeof stage === "string";
  const hasDeadline = typeof deadline === "string";
  if (dealId == null || (!hasStage && !hasDeadline)) {
    return createErrorResponse(400, "Missing dealId, stage or deadline");
  }
  if (hasDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return createErrorResponse(400, "Deadline must use YYYY-MM-DD");
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

  const listId = hasStage
    ? resolveTrelloListForDealStage({
        stage,
        category: deal.category,
      })
    : null;
  if (hasStage && !listId) {
    return createErrorResponse(422, `Stage ${stage} has no Trello list`);
  }

  try {
    if (listId) {
      await writeTrelloCardList({
        cardId: deal.trello_card_id,
        listId,
        apiKey,
        token,
      });
    }
    if (hasDeadline) {
      await writeTrelloCardDueDate({
        cardId: deal.trello_card_id,
        deadline,
        apiKey,
        token,
      });
    }
  } catch (error) {
    return createErrorResponse(502, (error as Error).message);
  }

  return new Response(JSON.stringify({ ok: true, listId, deadline }), {
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
