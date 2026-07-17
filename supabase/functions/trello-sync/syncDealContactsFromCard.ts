import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  contactNameFromEmail,
  extractTrelloContactEmails,
} from "./extractTrelloContacts.ts";
import type { TrelloCardInput } from "./trelloCardTypes.ts";

// Trello cards often contain the client's email next to the shared login
// details. Reuse that operational data to build the CRM relationship: existing
// company contacts are linked, and previously unknown external addresses are
// created as warm contacts. Team/internal addresses are deliberately ignored.
export const syncDealContactsFromCard = async ({
  card,
  companyId,
  companyName,
  currentContactIds,
  salesId,
  sourceAuthor,
  sourceText,
}: {
  card: TrelloCardInput;
  companyId: number;
  companyName: string;
  currentContactIds: number[];
  salesId: number;
  sourceAuthor?: string | null;
  sourceText?: string;
}): Promise<number[]> => {
  const linkedIds = new Set(currentContactIds);

  const { data: companyContacts, error: companyContactsError } =
    await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("company_id", companyId);
  if (companyContactsError) {
    throw new Error(
      `Could not load contacts for company ${companyId}: ${companyContactsError.message}`,
    );
  }
  for (const contact of companyContacts ?? []) {
    linkedIds.add(contact.id as number);
  }

  const emails = extractTrelloContactEmails(
    sourceText ?? `${card.name}\n${card.desc}`,
  );
  for (const email of emails) {
    const { data: matches, error: lookupError } = await supabaseAdmin
      .from("contacts")
      .select("id, company_id")
      .contains("email_jsonb", JSON.stringify([{ email }]))
      .limit(1);
    if (lookupError) {
      throw new Error(
        `Could not look up Trello contact ${email}: ${lookupError.message}`,
      );
    }

    const existing = matches?.[0];
    if (existing) {
      linkedIds.add(existing.id as number);
      if (existing.company_id == null) {
        const { error: linkCompanyError } = await supabaseAdmin
          .from("contacts")
          .update({ company_id: companyId })
          .eq("id", existing.id);
        if (linkCompanyError) {
          throw new Error(
            `Could not link contact ${existing.id} to company ${companyId}: ${linkCompanyError.message}`,
          );
        }
      }
      continue;
    }

    const { firstName, lastName } = contactNameFromEmail(email, companyName);
    const now = new Date().toISOString();
    const trimmedSourceAuthor = sourceAuthor?.trim();
    const { data: created, error: createError } = await supabaseAdmin
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email_jsonb: [{ email, type: "Work" }],
        company_id: companyId,
        sales_id: salesId,
        activity_source: "trello",
        ...(trimmedSourceAuthor
          ? { activity_source_author: trimmedSourceAuthor }
          : {}),
        first_seen: now,
        last_seen: now,
        status: "warm",
        tags: [],
        phone_jsonb: [],
      })
      .select("id")
      .single();
    if (createError || !created) {
      throw new Error(
        `Could not create Trello contact ${email}: ${createError?.message}`,
      );
    }
    linkedIds.add(created.id as number);
  }

  return Array.from(linkedIds);
};
