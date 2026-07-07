import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Soft-deletes the deal linked to a Trello card when the card itself is
// deleted on the board. A no-op when no deal was ever linked (e.g. the card
// was created and deleted before any sync ran).
export const archiveDealByCardId = async (trelloCardId: string) => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({ archived_at: new Date().toISOString() })
    .eq("trello_card_id", trelloCardId)
    .is("archived_at", null);
  if (error) {
    throw new Error(
      `Could not archive deal for Trello card ${trelloCardId}: ${error.message}`,
    );
  }
};

// The reverse: a card that is un-archived (sent back to the board) in Trello
// brings its deal back too. A no-op when the deal is not archived.
export const unarchiveDealByCardId = async (trelloCardId: string) => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({ archived_at: null })
    .eq("trello_card_id", trelloCardId)
    .not("archived_at", "is", null);
  if (error) {
    throw new Error(
      `Could not unarchive deal for Trello card ${trelloCardId}: ${error.message}`,
    );
  }
};
