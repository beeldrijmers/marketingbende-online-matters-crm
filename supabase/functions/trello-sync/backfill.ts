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
import { syncCardAttachments } from "./syncCardAttachments.ts";
import { addTrelloCommentAsDealNote } from "./addTrelloCommentAsDealNote.ts";
import { archiveDealByCardId } from "./archiveDealByCardId.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import {
  countTrelloSyncStages,
  emptyTrelloSyncStageCounts,
  type TrelloSyncStageCounts,
} from "./stageCounts.ts";
import {
  completeTrelloIntegrationRun,
  failTrelloIntegrationRun,
  startTrelloIntegrationRun,
  type TrelloRunKind,
} from "./integrationRun.ts";

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
  // .limit(1): should duplicates ever exist (e.g. two syncs raced before this
  // check), the check must keep working instead of failing on "multiple rows"
  // forever after.
  const { data, error } = await supabaseAdmin
    .from("deal_notes")
    .select("id")
    .eq("deal_id", dealId)
    .eq("date", date)
    .eq("text", text)
    .limit(1)
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

  // Import the card's uploaded files (idempotent: already-imported attachments
  // are skipped by their marker, so re-running the backfill is safe).
  const attachmentCount = await syncCardAttachments({
    dealId,
    attachments: fullCard.uploadedAttachments,
    apiKey,
    token,
  });

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

  return {
    cardId: card.id,
    dealId,
    commentCount: comments.length,
    attachmentCount,
  };
};

// Archived Trello cards never made it into the CRM (the backfill covers the
// open board), but several carry uploaded files the team still needs. Import
// every archived card that has uploads as an ARCHIVED deal: it gets its
// description, comments and attachments, but stays off the kanban board and
// gets no tasks (steps of a finished project are noise).
const backfillArchivedCardWithUploads = async (
  card: Awaited<ReturnType<typeof fetchTrelloBoardCards>>[number],
): Promise<{ attachmentCount: number }> => {
  const fullCard = await fetchTrelloCard(card.id);
  if (!fullCard.uploadedAttachments.length) return { attachmentCount: 0 };

  // Strip the checklist items so no tasks are created for archived projects.
  const dealId = await upsertDealFromCard({
    ...fullCard,
    checkItems: [],
    checklistsPresent: false,
  });

  // Comments first, while the deal is still active on first import
  // (addTrelloCommentAsDealNote only touches non-archived deals). On re-runs
  // the deal is already archived and the comments already imported.
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

  const attachmentCount = await syncCardAttachments({
    dealId,
    attachments: fullCard.uploadedAttachments,
    apiKey,
    token,
  });

  // No-op when the deal is already archived (re-runs).
  await archiveDealByCardId(card.id);

  return { attachmentCount };
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

export interface BackfillFailure {
  cardId: string;
  cardName: string;
  error: string;
}

const getActiveTrelloStageCounts = async (): Promise<TrelloSyncStageCounts> => {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("stage")
    .not("trello_card_id", "is", null)
    .is("archived_at", null);

  if (error) {
    // The cards themselves are already synchronized. Keep that successful
    // result usable even if this non-critical reporting query fails.
    console.error("Could not summarize Trello deal stages:", error.message);
    return emptyTrelloSyncStageCounts();
  }
  return countTrelloSyncStages(data ?? []);
};

export interface TrelloSyncSummary {
  cardCount: number;
  synced: number;
  totalComments: number;
  totalAttachments: number;
  archivedCardsWithUploads: number;
  archivedAttachments: number;
  durationMs: number;
  stageCounts: TrelloSyncStageCounts;
  failed: BackfillFailure[];
}

const executeTrelloSync = async (
  startedAt: number,
): Promise<TrelloSyncSummary> => {
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
  let totalAttachments = 0;
  // Per-card error isolation: one broken card (a Trello 429, a card deleted
  // mid-run, one bad record) must not abort the whole run and leave every
  // remaining card unsynced. Failures are collected and reported in the
  // summary instead.
  const failed: BackfillFailure[] = [];
  await runWithConcurrency(
    cards,
    async (card) => {
      try {
        const result = await backfillCard(card);
        synced += 1;
        totalComments += result.commentCount;
        totalAttachments += result.attachmentCount;
        // eslint-disable-next-line no-console
        console.log(
          `[${synced}/${cards.length}] "${card.name}" -> deal ${result.dealId} (${result.commentCount} comments)`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ cardId: card.id, cardName: card.name, error: message });
        console.error(`Backfill failed for card "${card.name}":`, message);
      }
    },
    CARD_CONCURRENCY,
  );
  // Every single card failing points at something systemic (credentials, DB
  // down) — that should surface as a hard error, not a "successful" summary.
  if (cards.length > 0 && failed.length === cards.length) {
    throw new Error(
      `Backfill failed for all ${cards.length} cards; first error: ${failed[0].error}`,
    );
  }

  // Second phase: archived cards that carry uploaded files.
  const archivedCards = await fetchTrelloBoardCards({
    boardId: BOARD_ID,
    apiKey,
    token,
    state: "closed",
  });
  const archivedWithUploads = archivedCards.filter(
    (card) => card.uploadedAttachments.length > 0,
  );
  // Same company pre-create as above, for the same concurrency reason.
  const archivedCompanyNames = [
    ...new Set(archivedWithUploads.map((card) => resolveCompanyName(card))),
  ];
  for (const name of archivedCompanyNames) {
    await findOrCreateCompany({ name, salesId });
  }
  let archivedAttachments = 0;
  await runWithConcurrency(
    archivedWithUploads,
    async (card) => {
      try {
        const result = await backfillArchivedCardWithUploads(card);
        archivedAttachments += result.attachmentCount;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ cardId: card.id, cardName: card.name, error: message });
        console.error(
          `Backfill failed for archived card "${card.name}":`,
          message,
        );
      }
    },
    CARD_CONCURRENCY,
  );

  const stageCounts = await getActiveTrelloStageCounts();
  const durationMs = Date.now() - startedAt;

  // eslint-disable-next-line no-console
  console.log(
    `Done in ${durationMs}ms. Synced ${synced} deals, ${totalComments} comments, ${totalAttachments} new attachments, ${archivedAttachments} attachments from ${archivedWithUploads.length} archived cards, ${failed.length} failures.`,
  );
  return {
    cardCount: cards.length,
    synced,
    totalComments,
    totalAttachments,
    archivedCardsWithUploads: archivedWithUploads.length,
    archivedAttachments,
    durationMs,
    stageCounts,
    failed,
  };
};

export const run = async ({
  runKind = "manual",
}: {
  runKind?: TrelloRunKind;
} = {}): Promise<TrelloSyncSummary> => {
  const startedAt = Date.now();
  const runId = await startTrelloIntegrationRun({ runKind, startedAt });

  try {
    const summary = await executeTrelloSync(startedAt);
    await completeTrelloIntegrationRun(runId, summary);
    return summary;
  } catch (error) {
    await failTrelloIntegrationRun({ runId, startedAt, error });
    throw error;
  }
};

if (import.meta.main) {
  await run({ runKind: "backfill" });
}
