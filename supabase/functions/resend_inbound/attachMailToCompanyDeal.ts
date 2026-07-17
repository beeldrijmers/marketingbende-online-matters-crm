import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { addNoteToDeal } from "../postmark/addNoteToDeal.ts";

const DEFAULT_DEAL_STAGE = "informatie-pipeline";
const DEFAULT_DEAL_CATEGORY = "overig";

// Routes an inbound mail to an EXISTING company that was recognised by name in
// the subject/body (see matchCompanyInText). It enriches the company's newest
// active deal — or opens one — and files the mail as a deal note. Used for a
// self-authored update that names a client but carries no client e-mail
// address, so nothing new is created from a sender domain. Best-effort: any
// failure is logged and returns null (the caller then still 2xx-acks).
export const attachMailToCompanyDeal = async ({
  companyId,
  subject,
  noteContent,
  salesEmail,
  salesId,
  assigneeIds,
  sourceEventId,
}: {
  companyId: number;
  subject: string;
  noteContent: string;
  salesEmail: string;
  salesId: number | null;
  assigneeIds: number[];
  sourceEventId?: string;
}): Promise<number | null> => {
  try {
    const { data: existingDeal, error: dealError } = await supabaseAdmin
      .from("deals")
      .select("id, assignee_ids")
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

    let dealId: number;
    if (existingDeal) {
      dealId = existingDeal.id as number;
      // Union any newly-involved team member into the assignees (never remove).
      const currentAssignees = (existingDeal.assignee_ids as number[]) ?? [];
      const mergedAssignees = [
        ...new Set([...currentAssignees, ...assigneeIds]),
      ];
      if (mergedAssignees.length > currentAssignees.length) {
        const { error: updateError } = await supabaseAdmin
          .from("deals")
          .update({ assignee_ids: mergedAssignees })
          .eq("id", dealId);
        if (updateError) {
          console.error(
            `Could not update assignees on deal ${dealId}: ${updateError.message}`,
          );
        }
      }
    } else {
      const { data: createdDeal, error: createError } = await supabaseAdmin
        .from("deals")
        .insert({
          name: subject.trim() || "Update via e-mail",
          company_id: companyId,
          stage: DEFAULT_DEAL_STAGE,
          category: DEFAULT_DEAL_CATEGORY,
          ...(salesId != null ? { sales_id: salesId } : {}),
          ...(assigneeIds.length > 0 ? { assignee_ids: assigneeIds } : {}),
        })
        .select("id")
        .single();
      if (createError || !createdDeal) {
        console.error(
          `Could not create deal for company ${companyId}: ${createError?.message}`,
        );
        return null;
      }
      dealId = createdDeal.id as number;
    }

    const noteResponse = await addNoteToDeal({
      salesEmail,
      dealId,
      noteContent,
      attachments: [],
      sourceEventId,
    });
    if (!noteResponse.ok) {
      console.error(
        `Could not add mail note to deal ${dealId} (status ${noteResponse.status})`,
      );
      return null;
    }
    return dealId;
  } catch (error) {
    console.error("attachMailToCompanyDeal failed (best-effort):", error);
    return null;
  }
};
