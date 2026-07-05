import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import {
  resolveCategory,
  resolveStage,
  resolveDealName,
} from "./resolveDealFields.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import { extractCompanyWebsite } from "./extractCompanyWebsite.ts";
import type { TrelloCardInput } from "./trelloCardTypes.ts";

// The prefix of the auto-generated placeholder description used before a card
// carried a real description. A deal whose description is still this placeholder
// (or empty) may be safely enriched on re-sync; anything else is treated as a
// manual edit and left untouched.
const LEGACY_DESCRIPTION_PREFIX = "Gemigreerd vanuit Trello:";

// Builds the deal description from the card: the card's own description when it
// has one, with a link back to the source card appended; otherwise the legacy
// placeholder so the source is always traceable.
const buildDealDescription = (card: TrelloCardInput): string => {
  const trimmed = card.desc.trim();
  return trimmed
    ? `${trimmed}\n\nBron (Trello): ${card.url}`
    : `${LEGACY_DESCRIPTION_PREFIX} ${card.url}`;
};

// Creates or updates the deal linked to a Trello card (matched via
// trello_card_id). Fields that Trello doesn't own (amount, sales_id,
// contact_ids) are only set on creation and never overwritten. The description
// is enriched from the card, but only when the existing one is still the
// auto-generated placeholder (or empty), so manual edits survive future syncs.
export const upsertDealFromCard = async (card: TrelloCardInput) => {
  const companyName = resolveCompanyName(card);
  const category = resolveCategory(card.idList, card.labelNames);
  const stage = resolveStage(card.idList, card.labelNames, card.dueComplete);
  const name = resolveDealName(card.name);
  const expectedClosingDate = card.due ? card.due.slice(0, 10) : null;
  const website = extractCompanyWebsite(card.desc, card.attachmentUrls);
  const description = buildDealDescription(card);

  const { data: existingDeal, error: fetchError } = await supabaseAdmin
    .from("deals")
    .select("id, description")
    .eq("trello_card_id", card.id)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up deal for Trello card ${card.id}: ${fetchError.message}`,
    );
  }

  const salesId = await resolveDefaultSalesId();
  const companyId = await findOrCreateCompany({
    name: companyName,
    salesId,
    website,
  });

  if (existingDeal) {
    const currentDescription = existingDeal.description as string | null;
    const canEnrichDescription =
      card.desc.trim().length > 0 &&
      (!currentDescription ||
        currentDescription.startsWith(LEGACY_DESCRIPTION_PREFIX));

    const { error: updateError } = await supabaseAdmin
      .from("deals")
      .update({
        name,
        company_id: companyId,
        category,
        stage,
        expected_closing_date: expectedClosingDate,
        ...(canEnrichDescription ? { description } : {}),
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
      description,
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
