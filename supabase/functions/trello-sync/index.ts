// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyTrelloWebhookRequest } from "./verifyTrelloWebhookRequest.ts";
import { fetchTrelloCard } from "./fetchTrelloCard.ts";
import { upsertDealFromCard } from "./upsertDealFromCard.ts";
import { archiveDealByCardId } from "./archiveDealByCardId.ts";
import { addTrelloCommentAsDealNote } from "./addTrelloCommentAsDealNote.ts";
import { run as runTrelloBackfill } from "./backfill.ts";
import { WON_LIST_ID } from "./trelloListMaps.ts";
import { isMoveToWonList, sendCardDoneNotification } from "./notifyCardDone.ts";
import { claimWonNotification } from "./claimWonNotification.ts";
import { syncCardAttachments } from "./syncCardAttachments.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const TRELLO_API_KEY = Deno.env.get("TRELLO_API_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";

// The body an authenticated CRM user sends from the "Synchroniseer Trello"
// button on the deals board to pull every card into the CRM.
const isSyncAllTrigger = (rawBody: string): boolean => {
  try {
    return JSON.parse(rawBody)?.trigger === "sync_all";
  } catch {
    return false;
  }
};

// Action types that mean "the card (its stage/category/name/steps) may have
// changed" - the full, authoritative card is re-fetched and upserted for all of
// them. The checkItem/checklist actions keep the deal's steps in sync when they
// are ticked off, added or removed in Trello.
const CARD_SYNC_ACTIONS = new Set([
  "createCard",
  "updateCard",
  "addLabelToCard",
  "removeLabelToCard",
  "moveCardToBoard",
  "updateCheckItemStateOnCard",
  "createCheckItem",
  "updateCheckItem",
  "deleteCheckItem",
  "addChecklistToCard",
  "removeChecklistFromCard",
  // A newly uploaded file: the re-fetched card carries it and the attachment
  // import below pulls it into the CRM.
  "addAttachmentToCard",
]);

Deno.serve(async (req) => {
  // The "Synchroniseer Trello" button is a browser fetch (cross-origin), so it
  // sends a CORS preflight; the webhook/CI callers never do.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Trello sends a HEAD (and sometimes an empty POST) request when a webhook
  // is first registered, purely to confirm the callback URL responds with 2xx.
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return new Response(null, { status: 405 });

  // One-time (re-runnable) admin trigger for the historical-card backfill.
  // Deliberately checked via its own header/secret, entirely separate from
  // the Trello webhook auth below, so the two callers can't be confused for
  // one another. Inert unless ADMIN_BACKFILL_SECRET is configured.
  const adminBackfillSecret = Deno.env.get("ADMIN_BACKFILL_SECRET");
  if (
    adminBackfillSecret &&
    req.headers.get("x-admin-backfill-secret") === adminBackfillSecret
  ) {
    try {
      const summary = await runTrelloBackfill();
      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const rawBody = await req.text();

  // Authenticated CRM user pressing "Synchroniseer Trello": pull every card in.
  // Verified with the caller's own Supabase JWT (AuthMiddleware, JWKS), entirely
  // separate from the Trello webhook HMAC path below. Caught BEFORE the webhook
  // verification because this request carries no Trello signature.
  if (isSyncAllTrigger(rawBody)) {
    return AuthMiddleware(req, async () => {
      try {
        const summary = await runTrelloBackfill();
        return new Response(JSON.stringify({ data: summary }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        console.error("trello sync_all failed:", error);
        return createErrorResponse(
          500,
          `Synchroniseren met Trello is mislukt: ${
            error instanceof Error ? error.message : "Onbekende fout"
          }`,
        );
      }
    });
  }

  const isAuthorized = await verifyTrelloWebhookRequest(req, rawBody);
  if (!isAuthorized) return new Response("Unauthorized", { status: 401 });

  if (!rawBody) return new Response("OK"); // Trello's registration probe

  const { action } = JSON.parse(rawBody);
  if (!action?.type) {
    // Return a 403 so Trello knows retrying this exact payload is pointless.
    return new Response("Missing action.type", { status: 403 });
  }

  try {
    if (CARD_SYNC_ACTIONS.has(action.type)) {
      const cardId = action.data?.card?.id;
      if (!cardId)
        return new Response("Missing action.data.card.id", { status: 403 });
      const card = await fetchTrelloCard(cardId);
      const dealId = await upsertDealFromCard(card);
      // Pull any uploaded files on the card into the CRM (idempotent,
      // best-effort: an attachment failure never fails the card sync).
      await syncCardAttachments({
        dealId,
        attachments: card.uploadedAttachments,
        apiKey: TRELLO_API_KEY,
        token: TRELLO_TOKEN,
      });
      // When the card was just moved into "Klaar", let the team lead know the
      // project is finished (and by whom). Only fires on the actual transition,
      // and claimWonNotification makes sure a retried/duplicate webhook delivery
      // does not e-mail twice.
      if (
        isMoveToWonList(action, WON_LIST_ID) &&
        (await claimWonNotification(dealId))
      ) {
        await sendCardDoneNotification({
          projectName: card.name,
          doneBy: action.memberCreator?.fullName ?? "Iemand",
          cardUrl: card.url,
        });
      }
      return new Response("OK");
    }

    if (action.type === "commentCard") {
      const cardId = action.data?.card?.id;
      const commentText = action.data?.text;
      const authorName = action.memberCreator?.fullName ?? "Onbekend";
      if (!cardId || !commentText) {
        return new Response("Missing action.data.card.id or action.data.text", {
          status: 403,
        });
      }
      await addTrelloCommentAsDealNote({
        trelloCardId: cardId,
        authorName,
        commentText,
      });
      return new Response("OK");
    }

    if (action.type === "deleteCard") {
      const cardId = action.data?.card?.id;
      if (!cardId)
        return new Response("Missing action.data.card.id", { status: 403 });
      await archiveDealByCardId(cardId);
      return new Response("OK");
    }

    // Unhandled action types (e.g. board/list-level events) are ignored.
    return new Response("OK");
  } catch (error) {
    return new Response(`Trello sync failed: ${(error as Error).message}`, {
      status: 500,
    });
  }
});

/* To invoke locally:
  1. Run `make start`
  2. Make sure `supabase/functions/.env` has TRELLO_API_KEY, TRELLO_TOKEN,
     TRELLO_SYNC_DEFAULT_SALES_EMAIL and TRELLO_WEBHOOK_SHARED_SECRET set.
  3. In another terminal, run `make start-supabase-functions`
  4. In another terminal, make an HTTP request (createCard example):
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/trello-sync?secret=local-dev-secret' \
    --header 'Content-Type: application/json' \
    --data '{
      "action": {
        "type": "createCard",
        "data": {
          "card": { "id": "<real Trello card id>" },
          "list": { "id": "<real Trello list id>" }
        }
      }
    }'

  Comment example:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/trello-sync?secret=local-dev-secret' \
    --header 'Content-Type: application/json' \
    --data '{
      "action": {
        "type": "commentCard",
        "memberCreator": { "fullName": "John Plantenga" },
        "data": {
          "card": { "id": "<real Trello card id>" },
          "text": "Klant heeft akkoord gegeven op de offerte."
        }
      }
    }'

  Delete example:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/trello-sync?secret=local-dev-secret' \
    --header 'Content-Type: application/json' \
    --data '{
      "action": {
        "type": "deleteCard",
        "data": { "card": { "id": "<real Trello card id>" } }
      }
    }'

  To register the real webhook once the CRM is deployed to a public URL:
  Note: the custom domain (crm.marketingbende.nl) only serves the static
  frontend via GitHub Pages - it does not proxy to Supabase. Edge functions
  are only reachable at the project's own Supabase URL
  (https://<project-ref>.supabase.co/functions/v1/<name>).
  curl -i --location --request POST 'https://api.trello.com/1/webhooks' \
    --header 'Content-Type: application/json' \
    --data '{
      "key": "<TRELLO_API_KEY>",
      "token": "<TRELLO_TOKEN>",
      "callbackURL": "https://<project-ref>.supabase.co/functions/v1/trello-sync?secret=<TRELLO_WEBHOOK_SHARED_SECRET>",
      "idModel": "6979f9a8a825b6ff46306e8a",
      "description": "Marketingbende CRM sync"
    }'

  To (re-)run the one-time historical-card backfill against a deployed
  environment, without ever needing that environment's Supabase service role
  key locally (the deployed function already has it injected):
  curl -i --location --request POST 'https://<project-ref>.supabase.co/functions/v1/trello-sync' \
    --header 'x-admin-backfill-secret: <ADMIN_BACKFILL_SECRET>'
*/
