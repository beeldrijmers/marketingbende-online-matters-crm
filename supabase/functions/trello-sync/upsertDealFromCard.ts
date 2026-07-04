import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import {
  resolveCategory,
  resolveStage,
  resolveDealName,
} from "./resolveDealFields.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import type { TrelloCardInput } from "./trelloCardTypes.ts";

// Creates or updates the deal linked to a Trello card (matched via
// trello_card_id). Fields that Trello doesn't own (description beyond the
// initial breadcrumb, amount, sales_id, contact_ids) are only set on
// creation and never overwritten afterwards, so manual edits made in the
// CRM survive future syncs.
export const upsertDealFromCard = async (card: TrelloCardInput) => {
  const companyName = resolveCompanyName(card);
  const category = resolveCategory(card.idList, card.labelNames);
  const stage = resolveStage(card.idList, card.labelNames, card.dueComplete);
  const name = resolveDealName(card.name);
  const expectedClosingDate = card.due ? card.due.slice(0, 10) : null;

  const { data: existingDeal, error: fetchError } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("trello_card_id", card.id)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up deal for Trello card ${card.id}: ${fetchError.message}`,
    );
  }

  const salesId = await resolveDefaultSalesId();
  const companyId = await findOrCreateCompany({ name: companyName, salesId });

  if (existingDeal) {
    const { error: updateError } = await supabaseAdmin
      .from("deals")
      .update({
        name,
        company_id: companyId,
        category,
        stage,
        expected_closing_date: expectedClosingDate,
      })
      .eq("id", existingDeal.id);
    if (updateError) {
      throw new Error(
        `Could not update deal for Trello card ${card.id}: ${updateError.message}`,
      );
    }
    return existingDeal.id;
  }

  const { data: createdDeal, error: createError } = await supabaseAdmin
    .from("deals")
    .insert({
      name,
      company_id: companyId,
      category,
      stage,
      expected_closing_date: expectedClosingDate,
      description: `Gemigreerd vanuit Trello: ${card.url}`,
      trello_card_id: card.id,
      sales_id: salesId,
    })
    .select("id")
    .single();
  if (createError || !createdDeal) {
    throw new Error(
      `Could not create deal for Trello card ${card.id}: ${createError?.message}`,
    );
  }
  return createdDeal.id;
};
