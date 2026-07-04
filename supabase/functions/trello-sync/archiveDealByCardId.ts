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
