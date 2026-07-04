import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";

// Mirrors a Trello card comment onto the linked deal as a note. The Trello
// author's name is prefixed into the note text (rather than attempted to be
// matched to a CRM sales user) since Trello members don't reliably map to
// CRM accounts (e.g. Rick Maarssen has no CRM login yet).
export const addTrelloCommentAsDealNote = async ({
  trelloCardId,
  authorName,
  commentText,
  date,
}: {
  trelloCardId: string;
  authorName: string;
  commentText: string;
  // Historical Trello comment date, for the one-time backfill. Omitted for
  // live webhook events, where the DB default (now()) is the correct value.
  date?: string;
}) => {
  const { data: deal, error: fetchError } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("trello_card_id", trelloCardId)
    .is("archived_at", null)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up deal for Trello card ${trelloCardId}: ${fetchError.message}`,
    );
  }
  if (!deal) return null;

  const salesId = await resolveDefaultSalesId();
  const { error: createNoteError } = await supabaseAdmin
    .from("deal_notes")
    .insert({
      deal_id: deal.id,
      text: `[Trello - ${authorName}]\n${commentText}`,
      sales_id: salesId,
      ...(date ? { date } : {}),
    });
  if (createNoteError) {
    throw new Error(
      `Could not add Trello comment as note to deal ${deal.id}: ${createNoteError.message}`,
    );
  }
  return deal.id;
};
