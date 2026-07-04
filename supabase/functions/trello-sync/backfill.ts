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
import { fetchTrelloCardComments } from "./fetchTrelloCardComments.ts";
import { upsertDealFromCard } from "./upsertDealFromCard.ts";
import { addTrelloCommentAsDealNote } from "./addTrelloCommentAsDealNote.ts";

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
  const dealId = await upsertDealFromCard(card);

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

  let synced = 0;
  let totalComments = 0;
  for (const card of cards) {
    const result = await backfillCard(card);
    synced += 1;
    totalComments += result.commentCount;
    // eslint-disable-next-line no-console
    console.log(
      `[${synced}/${cards.length}] "${card.name}" -> deal ${result.dealId} (${result.commentCount} comments)`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Synced ${synced} deals, ${totalComments} comments.`);
  return { cardCount: cards.length, synced, totalComments };
};

if (import.meta.main) {
  await run();
}
