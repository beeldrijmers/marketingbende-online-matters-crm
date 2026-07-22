import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveCompanyName } from "./companyNameOverrides.ts";
import {
  resolveCategoryWithSource,
  resolveStage,
  resolveDealName,
  resolveIsInternal,
  resolveRevenuePeriod,
} from "./resolveDealFields.ts";
import { DEFAULT_CATEGORY, isKnownTrelloList } from "./trelloListMaps.ts";
import { findOrCreateCompany } from "./findOrCreateCompany.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import { extractCompanyWebsite } from "./extractCompanyWebsite.ts";
import {
  extractDealAmount,
  hasExplicitPriceCorrection,
} from "./extractDealAmount.ts";
import { lookupCompanyWebsite } from "./lookupCompanyWebsite.ts";
import { trelloCardCreatedAt } from "./trelloCardDate.ts";
import { syncCardChecklistItems } from "./syncCardChecklistItems.ts";
import { syncDealContactsFromCard } from "./syncDealContactsFromCard.ts";
import type { TrelloCardInput } from "./trelloCardTypes.ts";
import { trelloCommentTexts, trelloSourceText } from "./trelloSourceContext.ts";
import { withDerivedTrelloSteps } from "./extractTrelloNextSteps.ts";
import { loadActiveSalesByName } from "./salesNameLookup.ts";
import { mapCardMembersToSalesIds } from "./stepSyncLogic.ts";

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
// trello_card_id). The Trello title, known workflow list and previously synced
// description stay current. Enrichment fields never get cleared when a source
// has no value; only explicit Trello corrections may replace a synced amount
// or category. Contact ids are unioned, so manual CRM relationships survive.
export const upsertDealFromCard = async (
  card: TrelloCardInput,
  {
    sourceAuthor,
    syncSteps = true,
  }: { sourceAuthor?: string | null; syncSteps?: boolean } = {},
) => {
  const commentTexts = trelloCommentTexts(card.comments);
  const sourceText = trelloSourceText(card);
  const companyName = resolveCompanyName(card);
  const categoryResolution = resolveCategoryWithSource(
    card.idList,
    card.labelNames,
    sourceText,
  );
  const category = categoryResolution.category;
  const name = resolveDealName(card.name);
  const startDate = card.start ? card.start.slice(0, 10) : null;
  const deliveryDate = card.due ? card.due.slice(0, 10) : null;
  const website = extractCompanyWebsite(card.desc, card.attachmentUrls, [
    card.name,
    ...commentTexts,
  ]);
  const description = buildDealDescription(card);
  // Happr is Marketingbende's own product: its cards are internal work, never
  // client revenue, so no amount is ever attached to them.
  const amount =
    category === "happr"
      ? null
      : extractDealAmount(card.name, card.desc, commentTexts);
  const revenuePeriod = resolveRevenuePeriod(category, [
    ...[...commentTexts].reverse(),
    card.name,
    card.desc,
  ]);
  // The real project start: decoded from the Trello card id so a long-running
  // deal keeps its true creation date instead of the import/backfill time.
  const createdAt = trelloCardCreatedAt(card.id);
  const trimmedSourceAuthor = sourceAuthor?.trim();

  // A list the team added without updating the sync's vocabulary: log it
  // loudly. New deals still get the fallback stage/category, but the stage of
  // existing deals is left to the CRM (below) so a whole column of cards is
  // never silently dragged to "facturatie-live".
  const knownList = isKnownTrelloList(card.idList);
  if (!knownList) {
    console.warn(
      `Trello list ${card.idList} (card ${card.id}) is not in the sync's list maps; using fallback stage/category. Update trelloListMaps.ts.`,
    );
  }

  const { data: existingDeal, error: fetchError } = await supabaseAdmin
    .from("deals")
    .select(
      "id, description, amount, revenue_period, category, contact_ids, activity_source",
    )
    .eq("trello_card_id", card.id)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up deal for Trello card ${card.id}: ${fetchError.message}`,
    );
  }

  const stage = resolveStage(card.idList, card.labelNames, card.dueComplete);

  // Card ownership is operationally authoritative. Only names that match an
  // active CRM user are applied; an empty/unmatched Trello member list never
  // clears an existing CRM assignment or makes a deal invisible through RLS.
  let trelloAssigneeIds: number[] = [];
  try {
    trelloAssigneeIds = mapCardMembersToSalesIds(
      card,
      await loadActiveSalesByName(),
    );
  } catch (error) {
    console.error(
      `Could not resolve Trello members for card ${card.id}:`,
      (error as Error).message,
    );
  }

  const defaultSalesId = await resolveDefaultSalesId();
  const salesId = trelloAssigneeIds[0] ?? defaultSalesId;
  const companyId = await findOrCreateCompany({
    name: companyName,
    salesId,
    sourceAuthor: trimmedSourceAuthor,
    website,
    // When the card carries no website, fall back to a best-effort web lookup so
    // the company can still get a logo. Runs at most once per company (only when
    // it has none yet).
    lookupWebsite: () => lookupCompanyWebsite(companyName),
  });

  let contactIds = (existingDeal?.contact_ids as number[] | null) ?? [];
  try {
    contactIds = await syncDealContactsFromCard({
      card,
      companyId,
      companyName,
      currentContactIds: contactIds,
      salesId,
      sourceAuthor: trimmedSourceAuthor,
      sourceText,
    });
  } catch (error) {
    // Contact enrichment is valuable but must never block the core card/deal
    // sync. A later webhook or manual backfill retries it automatically.
    console.error(
      `Could not enrich contacts for Trello card ${card.id}:`,
      (error as Error).message,
    );
  }

  if (existingDeal) {
    const currentDescription = existingDeal.description as string | null;
    const descriptionIsTrelloManaged =
      !currentDescription ||
      currentDescription.startsWith(LEGACY_DESCRIPTION_PREFIX) ||
      currentDescription.includes(`Bron (Trello): ${card.url}`);
    const canSyncDescription =
      descriptionIsTrelloManaged && currentDescription !== description;

    // Back-fill the amount only when the deal has none yet; never overwrite a
    // value someone entered/adjusted manually in the CRM.
    const currentAmount = existingDeal.amount as number | null;
    const canEnrichAmount = amount != null && !currentAmount;
    const canApplyExplicitAmountCorrection =
      amount != null &&
      currentAmount !== amount &&
      existingDeal.activity_source === "trello" &&
      commentTexts.some(hasExplicitPriceCorrection);

    // Same rule for the revenue period: normally only classify a deal that has
    // none yet. When an old default category is being corrected from an
    // explicit Trello label, correct its period too; this repairs historical
    // imports such as a one-off website task that was accidentally monthly.
    const currentRevenuePeriod = existingDeal.revenue_period as string | null;
    const canEnrichRevenuePeriod =
      revenuePeriod != null && !currentRevenuePeriod;

    // An explicit Trello list/label stays authoritative when it changes. Text
    // inference is weaker: it may fill only an unclassified/default deal and
    // never overwrite a person's deliberate CRM classification.
    const currentCategory = existingDeal.category as string | null;
    const canUpdateCategory =
      category !== DEFAULT_CATEGORY &&
      currentCategory !== category &&
      (categoryResolution.source === "title" ||
        categoryResolution.source === "label" ||
        !currentCategory ||
        currentCategory === DEFAULT_CATEGORY);
    const canCorrectRevenuePeriod =
      (categoryResolution.source === "title" ||
        categoryResolution.source === "label" ||
        categoryResolution.source === "text") &&
      revenuePeriod != null &&
      currentRevenuePeriod !== revenuePeriod;
    const canCorrectTextRevenuePeriod =
      existingDeal.activity_source === "trello" &&
      categoryResolution.source === "default" &&
      (!currentCategory || currentCategory === DEFAULT_CATEGORY) &&
      revenuePeriod != null &&
      currentRevenuePeriod !== revenuePeriod;

    const { error: updateError } = await supabaseAdmin
      .from("deals")
      .update({
        name,
        company_id: companyId,
        ...(contactIds.length > 0 ? { contact_ids: contactIds } : {}),
        ...(trelloAssigneeIds.length > 0
          ? { sales_id: salesId, assignee_ids: trelloAssigneeIds }
          : {}),
        ...(canUpdateCategory ? { category } : {}),
        // Trello is authoritative for a card's known workflow list.
        ...(knownList ? { stage } : {}),
        // Trello dates enrich planning when present. Their absence never wipes
        // dates someone entered manually in the CRM.
        ...(startDate ? { start_date: startDate } : {}),
        ...(deliveryDate
          ? {
              delivery_date: deliveryDate,
              expected_closing_date: deliveryDate,
            }
          : {}),
        // Correct the historical import date to the real Trello creation date.
        // Deterministic per card, so re-syncs are idempotent.
        ...(createdAt ? { created_at: createdAt } : {}),
        ...(canSyncDescription ? { description } : {}),
        ...(canEnrichAmount || canApplyExplicitAmountCorrection
          ? { amount }
          : {}),
        ...(canEnrichRevenuePeriod ||
        canCorrectRevenuePeriod ||
        canCorrectTextRevenuePeriod
          ? { revenue_period: revenuePeriod }
          : {}),
      })
      .eq("id", existingDeal.id);
    if (updateError) {
      throw new Error(
        `Could not update deal for Trello card ${card.id}: ${updateError.message}`,
      );
    }
    // Mirror the card's checklist items onto the deal's steps.
    if (syncSteps) {
      await syncCardChecklistItems(
        withDerivedTrelloSteps(card),
        existingDeal.id,
      );
    }
    return existingDeal.id;
  }

  const { data: createdDeal, error: createError } = await supabaseAdmin
    .from("deals")
    .insert({
      name,
      company_id: companyId,
      ...(contactIds.length > 0 ? { contact_ids: contactIds } : {}),
      category,
      stage,
      // Internal/external classification, applied on creation only so the
      // manual toggle in the CRM always wins afterwards.
      is_internal: resolveIsInternal({ category, dealName: name, companyName }),
      ...(startDate ? { start_date: startDate } : {}),
      ...(deliveryDate
        ? {
            delivery_date: deliveryDate,
            expected_closing_date: deliveryDate,
          }
        : {}),
      description,
      ...(amount != null ? { amount } : {}),
      ...(revenuePeriod != null ? { revenue_period: revenuePeriod } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
      trello_card_id: card.id,
      sales_id: salesId,
      ...(trelloAssigneeIds.length > 0
        ? { assignee_ids: trelloAssigneeIds }
        : {}),
      activity_source: "trello",
      ...(trimmedSourceAuthor
        ? { activity_source_author: trimmedSourceAuthor }
        : {}),
    })
    .select("id")
    .single();
  if (createError || !createdDeal) {
    throw new Error(
      `Could not create deal for Trello card ${card.id}: ${createError?.message}`,
    );
  }
  // Mirror the card's checklist items onto the newly-created deal's steps.
  if (syncSteps) {
    await syncCardChecklistItems(withDerivedTrelloSteps(card), createdDeal.id);
  }
  return createdDeal.id;
};
