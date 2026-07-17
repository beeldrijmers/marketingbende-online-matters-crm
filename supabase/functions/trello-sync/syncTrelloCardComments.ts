import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import type { TrelloCommentInput } from "./trelloCardTypes.ts";
import {
  planTrelloCommentNoteSync,
  type ExistingTrelloNote,
} from "./trelloCommentNotePlan.ts";

// Mirrors the complete, current Trello comment history onto one deal. It is
// safe to run on every webhook and manual sync: the action id prevents
// duplicates, while edits/deletions converge on Trello's current state.
export const syncTrelloCardComments = async ({
  trelloCardId,
  comments,
}: {
  trelloCardId: string;
  comments: TrelloCommentInput[];
}): Promise<number> => {
  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("trello_card_id", trelloCardId)
    .maybeSingle();
  if (dealError) {
    throw new Error(
      `Could not look up deal for Trello card ${trelloCardId}: ${dealError.message}`,
    );
  }
  if (!deal) return 0;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("deal_notes")
    .select("id, text, date, activity_source_author, source_event_id")
    .eq("deal_id", deal.id)
    .eq("activity_source", "trello");
  if (existingError) {
    throw new Error(
      `Could not load Trello notes for deal ${deal.id}: ${existingError.message}`,
    );
  }

  const plan = planTrelloCommentNoteSync(
    comments,
    (existing ?? []) as ExistingTrelloNote[],
  );
  const salesId = await resolveDefaultSalesId();

  for (const update of plan.updates) {
    const { id, ...values } = update;
    const { error } = await supabaseAdmin
      .from("deal_notes")
      .update(values)
      .eq("id", id);
    if (error) {
      throw new Error(`Could not update Trello note ${id}: ${error.message}`);
    }
  }

  for (const insert of plan.inserts) {
    const { error } = await supabaseAdmin.from("deal_notes").insert({
      deal_id: deal.id,
      ...insert,
      sales_id: salesId,
      activity_source: "trello",
    });
    // Concurrent webhook/manual runs may race on the partial unique index.
    // The winning row already contains the same provider event, so this is a
    // successful idempotent outcome rather than a sync failure.
    if (error && error.code !== "23505") {
      throw new Error(
        `Could not insert Trello comment on deal ${deal.id}: ${error.message}`,
      );
    }
  }

  if (plan.deleteIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("deal_notes")
      .delete()
      .in("id", plan.deleteIds);
    if (error) {
      throw new Error(
        `Could not remove deleted Trello comments from deal ${deal.id}: ${error.message}`,
      );
    }
  }

  return comments.length;
};
