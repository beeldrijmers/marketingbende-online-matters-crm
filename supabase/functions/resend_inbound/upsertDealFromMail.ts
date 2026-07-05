import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { addNoteToDeal } from "../postmark/addNoteToDeal.ts";

// A deal born from an inbound mail opens in the first pipeline stage with the
// generic category, mirroring the safe fallbacks the Trello sync uses
// (resolveDealFields.ts / trelloListMaps.ts).
const DEFAULT_DEAL_STAGE = "informatie-pipeline";
const DEFAULT_DEAL_CATEGORY = "overig";

// Best-effort deal handling for an inbound mail. After a contact + note have
// already been written (the primary, must-succeed outcome), this opens a deal
// for the contact's company — or enriches the existing active one with any
// amount/dates parsed from the mail. Every failure is logged and swallowed so a
// hiccup here never fails the webhook (which would make Resend retry and
// duplicate the contact note).
//
// At most one deal is touched per company per mail: handled company ids are
// recorded in the caller-owned `handledCompanyIds` set.
export const upsertDealFromMail = async ({
  contactEmail,
  subject,
  companyNameFallback,
  amount,
  startDate,
  deliveryDate,
  salesEmail,
  salesId,
  noteContent,
  handledCompanyIds,
}: {
  contactEmail: string;
  subject: string;
  companyNameFallback: string;
  amount: number | null;
  startDate: string | null;
  deliveryDate: string | null;
  salesEmail: string;
  salesId: number | null;
  noteContent: string;
  handledCompanyIds: Set<number>;
}): Promise<number | null> => {
  try {
    // Resolve the just-created/matched contact and its company.
    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, company_id")
      .contains("email_jsonb", JSON.stringify([{ email: contactEmail }]))
      .maybeSingle();
    if (contactError || !contact) return null;

    const companyId = contact.company_id as number | null;
    // No company (e.g. a generic mail-provider domain) means no deal to anchor;
    // and each company is handled at most once per mail.
    if (companyId == null || handledCompanyIds.has(companyId)) return null;
    handledCompanyIds.add(companyId);

    // Newest non-archived deal for this company, if any.
    const { data: existingDeal, error: dealError } = await supabaseAdmin
      .from("deals")
      .select("id, amount, start_date, delivery_date")
      .eq("company_id", companyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dealError) {
      console.error(
        `Could not look up deals for company ${companyId}: ${dealError.message}`,
      );
      return null;
    }

    if (existingDeal) {
      // Fill only the still-empty fields; never overwrite a manual value. The
      // note itself is mirrored separately by linkMailToActiveDeals, so we leave
      // it untouched here to avoid duplicating it.
      const enrichment: {
        amount?: number;
        start_date?: string;
        delivery_date?: string;
      } = {
        ...(existingDeal.amount == null && amount != null ? { amount } : {}),
        ...(existingDeal.start_date == null && startDate
          ? { start_date: startDate }
          : {}),
        ...(existingDeal.delivery_date == null && deliveryDate
          ? { delivery_date: deliveryDate }
          : {}),
      };
      if (Object.keys(enrichment).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("deals")
          .update(enrichment)
          .eq("id", existingDeal.id);
        if (updateError) {
          console.error(
            `Could not enrich deal ${existingDeal.id} from mail: ${updateError.message}`,
          );
        }
      }
      return existingDeal.id as number;
    }

    // No active deal yet: open one so the inbound inquiry lands on the board.
    const name = subject.trim() || `Aanvraag ${companyNameFallback}`.trim();
    const { data: createdDeal, error: createError } = await supabaseAdmin
      .from("deals")
      .insert({
        name,
        company_id: companyId,
        contact_ids: [contact.id],
        stage: DEFAULT_DEAL_STAGE,
        category: DEFAULT_DEAL_CATEGORY,
        ...(amount != null ? { amount } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(deliveryDate ? { delivery_date: deliveryDate } : {}),
        ...(deliveryDate ? { expected_closing_date: deliveryDate } : {}),
        ...(salesId != null ? { sales_id: salesId } : {}),
      })
      .select("id")
      .single();
    if (createError || !createdDeal) {
      console.error(
        `Could not create deal from mail for company ${companyId}: ${createError?.message}`,
      );
      return null;
    }

    // linkMailToActiveDeals ran before this deal existed, so mirror the note now.
    const noteResponse = await addNoteToDeal({
      salesEmail,
      dealId: createdDeal.id as number,
      noteContent,
      attachments: [],
    });
    if (!noteResponse.ok) {
      console.error(
        `Could not add mail note to new deal ${createdDeal.id} (status ${noteResponse.status})`,
      );
    }
    return createdDeal.id as number;
  } catch (error) {
    console.error("upsertDealFromMail failed (best-effort):", error);
    return null;
  }
};
