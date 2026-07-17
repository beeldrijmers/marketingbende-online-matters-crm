import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { Attachment } from "./extractAndUploadAttachments.ts";
import { selectDealsForMail } from "./selectDealsForMail.ts";

// After a mail note has been added to a contact, mirror it onto the contact's
// active (non-archived) deals, so the deal timeline reflects the
// correspondence too — this is what makes "where do we stand" obvious.
//
// When the contact has SEVERAL active deals, the mail text picks the right
// card(s): a deal whose name appears in the subject/body receives the note
// exclusively; without any match the note lands on all active deals (the
// pre-existing behaviour, and the safer default).
//
// Best-effort: the contact note is the primary outcome and has already
// succeeded by the time this runs, so any failure here is logged and swallowed
// rather than failing the whole webhook (which would make Postmark retry and
// duplicate the contact note). Returns the number of deals the note reached.
export const linkMailToActiveDeals = async ({
  contactEmail,
  salesId,
  noteContent,
  attachments,
  sourceEventId,
}: {
  contactEmail: string;
  salesId: number;
  noteContent: string;
  attachments: Attachment[];
  sourceEventId?: string;
}): Promise<number> => {
  try {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .contains("email_jsonb", JSON.stringify([{ email: contactEmail }]))
      .maybeSingle();
    if (contactError || !contact) return 0;

    const { data: deals, error: dealsError } = await supabaseAdmin
      .from("deals")
      .select("id, name")
      .contains("contact_ids", [contact.id])
      .is("archived_at", null);
    if (dealsError || !deals?.length) return 0;

    // The note content starts with the mail subject, so matching against it
    // covers both subject and body.
    const targetDeals = selectDealsForMail(deals, noteContent);

    for (const deal of targetDeals) {
      const { error: noteError } = await supabaseAdmin
        .from("deal_notes")
        .insert({
          deal_id: deal.id,
          text: noteContent,
          sales_id: salesId,
          attachments,
          ...(sourceEventId ? { source_event_id: sourceEventId } : {}),
        });
      if (noteError && !(sourceEventId && noteError.code === "23505")) {
        console.error(
          `Could not mirror mail note to deal ${deal.id}: ${noteError.message}`,
        );
      }
    }

    return targetDeals.length;
  } catch (error) {
    console.error("linkMailToActiveDeals failed (best-effort):", error);
    return 0;
  }
};
