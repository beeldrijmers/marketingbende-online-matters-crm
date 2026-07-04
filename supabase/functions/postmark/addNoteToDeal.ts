import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { Attachment } from "./extractAndUploadAttachments.ts";

export const addNoteToDeal = async ({
  salesEmail,
  dealId,
  noteContent,
  attachments,
}: {
  salesEmail: string;
  dealId: number;
  noteContent: string;
  attachments: Attachment[];
}) => {
  const { data: sales, error: fetchSalesError } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("email", salesEmail)
    .neq("disabled", true)
    .maybeSingle();

  if (fetchSalesError) {
    return new Response(
      `Could not fetch sales from database, email: ${salesEmail}`,
      { status: 500 },
    );
  }
  if (!sales) {
    // Return a 403 to let Postmark know that it's no use to retry this request
    // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
    return new Response(
      `Unable to find (active) sales in database, email: ${salesEmail}`,
      { status: 403 },
    );
  }

  const { data: deal, error: fetchDealError } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .is("archived_at", null)
    .maybeSingle();
  if (fetchDealError) {
    return new Response(`Could not fetch deal ${dealId} from database`, {
      status: 500,
    });
  }
  if (!deal) {
    // Return a 403 to let Postmark know that it's no use to retry this request
    // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
    return new Response(`Unknown or archived deal: ${dealId}`, {
      status: 403,
    });
  }

  const { error: createNoteError } = await supabaseAdmin
    .from("deal_notes")
    .insert({
      deal_id: dealId,
      text: noteContent,
      sales_id: sales.id,
      attachments,
    });
  if (createNoteError) {
    return new Response(`Could not add note to deal ${dealId}`, {
      status: 500,
    });
  }

  return new Response("OK");
};
