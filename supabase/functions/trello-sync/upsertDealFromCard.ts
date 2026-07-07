import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import {
  resolveCategory,
  resolveStage,
  resolveDealName,
  resolveRevenuePeriod,
} from "./resolveDealFields.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import { extractCompanyWebsite } from "./extractCompanyWebsite.ts";
import { extractDealAmount } from "./extractDealAmount.ts";
import { lookupCompanyWebsite } from "./lookupCompanyWebsite.ts";
import { trelloCardCreatedAt } from "./trelloCardDate.ts";
import { syncCardChecklistItems } from "./syncCardChecklistItems.ts";
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
  const trimmed = (card.desc ?? "").trim();
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
  // Happr is Marketingbende's own product: its cards are internal work, never
  // client revenue, so no amount is ever attached to them.
  const amount =
    category === "happr" ? null : extractDealAmount(card.name, card.desc);
  const revenuePeriod = resolveRevenuePeriod(category);
  // The real project start: decoded from the Trello card id so a long-running
  // deal keeps its true creation date instead of the import/backfill time.
  const createdAt = trelloCardCreatedAt(card.id);

  const { data: existingDeal, error: fetchError } = await supabaseAdmin
    .from("deals")
    .select("id, description, amount, revenue_period")
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
    // When the card carries no website, fall back to a best-effort web lookup so
    // the company can still get a logo. Runs at most once per company (only when
    // it has none yet).
    lookupWebsite: () => lookupCompanyWebsite(companyName),
  });

  if (existingDeal) {
    const currentDescription = existingDeal.description as string | null;
    const canEnrichDescription =
      card.desc.trim().length > 0 &&
      (!currentDescription ||
        currentDescription.startsWith(LEGACY_DESCRIPTION_PREFIX));

    // Back-fill the amount only when the deal has none yet; never overwrite a
    // value someone entered/adjusted manually in the CRM.
    const currentAmount = existingDeal.amount as number | null;
    const canEnrichAmount = amount != null && !currentAmount;

    // Same rule for the revenue period: only classify a deal that has none yet,
    // and only when the category maps cleanly, so a manual correction stands.
    const currentRevenuePeriod = existingDeal.revenue_period as string | null;
    const canEnrichRevenuePeriod =
      revenuePeriod != null && !currentRevenuePeriod;

    // Monthly recurring deals run their own lifecycle in the CRM (the loopband
    // sends them back to the start each cycle), so the Trello list must not
    // drag their stage back to "won" on every sync. For those, leave the stage
    // to the CRM; all other cards still follow Trello.
    const isMonthly = (currentRevenuePeriod ?? revenuePeriod) === "maandelijks";

    const { error: updateError } = await supabaseAdmin
      .from("deals")
      .update({
        name,
        company_id: companyId,
        category,
        ...(isMonthly ? {} : { stage }),
        expected_closing_date: expectedClosingDate,
        // Correct the historical import date to the real Trello creation date.
        // Deterministic per card, so re-syncs are idempotent.
        ...(createdAt ? { created_at: createdAt } : {}),
        ...(canEnrichDescription ? { description } : {}),
        ...(canEnrichAmount ? { amount } : {}),
        ...(canEnrichRevenuePeriod ? { revenue_period: revenuePeriod } : {}),
      })
      .eq("id", existingDeal.id);
    if (updateError) {
      throw new Error(
        `Could not update deal for Trello card ${card.id}: ${updateError.message}`,
      );
    }
    // Mirror the card's checklist items onto the deal's steps.
    await syncCardChecklistItems(card, existingDeal.id);
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
      ...(amount != null ? { amount } : {}),
      ...(revenuePeriod != null ? { revenue_period: revenuePeriod } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
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
  // Mirror the card's checklist items onto the newly-created deal's steps.
  await syncCardChecklistItems(card, createdDeal.id);
  return createdDeal.id;
};
