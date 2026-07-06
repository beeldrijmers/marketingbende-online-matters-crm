// One-time backfill: populates the CRM with a Deal (and Company) for every
// existing card on the "SEO - Online Matters" Trello board, plus a deal note
// per existing card comment. Safe to re-run: deals are matched/updated by
// trello_card_id, companies are matched by name, and comments already
// present as notes (same deal, date and text) are skipped.
//
// Usage (from the repo root, with the local Supabase stack running):
//   TRELLO_API_KEY=... TRELLO_TOKEN=... \
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... \
//   deno run --allow-net --allow-env supabase/functions/trello-sync/backfill.ts
//
// TRELLO_SYNC_DEFAULT_SALES_EMAIL must also be set (see supabase/functions/.env).

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { fetchTrelloBoardCards } from "./fetchTrelloBoardCards.ts";
import { fetchTrelloCard } from "./fetchTrelloCard.ts";
import { fetchTrelloCardComments } from "./fetchTrelloCardComments.ts";
import { upsertDealFromCard } from "./upsertDealFromCard.ts";
import { addTrelloCommentAsDealNote } from "./addTrelloCommentAsDealNote.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";

const BOARD_ID = "6979f9a8a825b6ff46306e8a"; // SEO - Online Matters

const apiKey = Deno.env.get("TRELLO_API_KEY");
const token = Deno.env.get("TRELLO_TOKEN");
if (!apiKey || !token) {
  throw new Error("Missing TRELLO_API_KEY or TRELLO_TOKEN env variable");
}

const commentAlreadyBackfilled = async ({
  dealId,
  date,
  text,
}: {
  dealId: number;
  date: string;
  text: string;
}): Promise<boolean> => {
  const { data, error } = await supabaseAdmin
    .from("deal_notes")
    .select("id")
    .eq("deal_id", dealId)
    .eq("date", date)
    .eq("text", text)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not check for existing note: ${error.message}`);
  }
  return !!data;
};

const backfillCard = async (
  card: Awaited<ReturnType<typeof fetchTrelloBoardCards>>[number],
) => {
  // Re-fetch the full card from the single-card endpoint: it reliably nests
  // checklist items + members (which the bulk board endpoint may omit), so the
  // deal's steps are synced during backfill exactly as they are on the webhook
  // path. One extra call per card is fine for a one-time backfill.
  const fullCard = await fetchTrelloCard(card.id);
  const dealId = await upsertDealFromCard(fullCard);

  const comments = await fetchTrelloCardComments({
    cardId: card.id,
    apiKey,
    token,
  });
  for (const comment of comments) {
    const text = `[Trello - ${comment.authorName}]\n${comment.text}`;
    if (await commentAlreadyBackfilled({ dealId, date: comment.date, text })) {
      continue;
    }
    await addTrelloCommentAsDealNote({
      trelloCardId: card.id,
      authorName: comment.authorName,
      commentText: comment.text,
      date: comment.date,
    });
  }

  return { cardId: card.id, dealId, commentCount: comments.length };
};

// Cards are processed with bounded concurrency rather than one at a time:
// sequentially, ~40 cards' worth of Trello API calls and Supabase round
// trips comfortably exceeds the Supabase Edge Function idle timeout (150s).
const CARD_CONCURRENCY = 8;

const runWithConcurrency = async <T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> => {
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );
};

export const run = async (): Promise<{
  cardCount: number;
  synced: number;
  totalComments: number;
}> => {
  const cards = await fetchTrelloBoardCards({
    boardId: BOARD_ID,
    apiKey,
    token,
  });
  // eslint-disable-next-line no-console
  console.log(`Fetched ${cards.length} cards from Trello board ${BOARD_ID}`);

  // Pre-create every distinct company sequentially, before the concurrent
  // card loop below. Otherwise two cards for the same not-yet-existing
  // company could both pass findOrCreateCompany's "not found" check at the
  // same time and each insert a duplicate row.
  const salesId = await resolveDefaultSalesId();
  const uniqueCompanyNames = [
    ...new Set(cards.map((card) => resolveCompanyName(card))),
  ];
  for (const name of uniqueCompanyNames) {
    await findOrCreateCompany({ name, salesId });
  }

  let synced = 0;
  let totalComments = 0;
  await runWithConcurrency(
    cards,
    async (card) => {
      const result = await backfillCard(card);
      synced += 1;
      totalComments += result.commentCount;
      // eslint-disable-next-line no-console
      console.log(
        `[${synced}/${cards.length}] "${card.name}" -> deal ${result.dealId} (${result.commentCount} comments)`,
      );
    },
    CARD_CONCURRENCY,
  );

  // eslint-disable-next-line no-console
  console.log(`Done. Synced ${synced} deals, ${totalComments} comments.`);
  return { cardCount: cards.length, synced, totalComments };
};

if (import.meta.main) {
  await run();
}
