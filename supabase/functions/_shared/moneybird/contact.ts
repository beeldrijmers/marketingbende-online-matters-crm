// Resolve the Moneybird contact for a CRM company, creating it when needed.
// Shared by estimates and invoices. A Moneybird contact id is only valid inside
// the administration it was created in, and every user connects their OWN
// administration, so the cache lives in moneybird_company_contacts keyed by
// (company_id, administration_id) — one contact per company PER administration.
//
// Resolution order:
//   1. cache hit for this (company, administration) -> reuse (no API call)
//   2. find an existing Moneybird contact by company name -> adopt + cache
//   3. create a new Moneybird contact -> cache
//
// The id is cached IMMEDIATELY, independent of whether the document that follows
// succeeds, so a retry after a failed document call reuses the same contact.

import { supabaseAdmin } from "../supabaseAdmin.ts";
import { createContact, findContactByCompanyName } from "./client.ts";
import { buildContactPayload, type CompanyForContact } from "./payload.ts";
import type { MoneybirdCredentials } from "./credentials.ts";

interface CompanyRow extends CompanyForContact {
  id: number;
}

export const findOrCreateMoneybirdContact = async (
  credentials: MoneybirdCredentials,
  company: CompanyRow,
): Promise<string> => {
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from("moneybird_company_contacts")
    .select("contact_id")
    .eq("company_id", company.id)
    .eq("administration_id", credentials.administrationId)
    .maybeSingle();
  if (cacheError) {
    throw new Error(
      `Could not read the Moneybird contact cache for company ${company.id}: ${cacheError.message}`,
    );
  }
  if (cached) {
    return cached.contact_id;
  }

  const existing = await findContactByCompanyName(credentials, company.name);
  const contactId = existing
    ? existing.id
    : (await createContact(credentials, buildContactPayload(company))).id;

  // Conditional cache write. The per-deal claim serializes per DEAL, not per
  // COMPANY, so two deals of the same company can resolve a contact
  // concurrently and both arrive here with a cache miss. The unique index on
  // (company_id, administration_id) makes exactly one insert win; the loser
  // detects the conflict and reuses the winner's contact.
  const { error: insertError } = await supabaseAdmin
    .from("moneybird_company_contacts")
    .insert({
      company_id: company.id,
      administration_id: credentials.administrationId,
      contact_id: contactId,
    });
  if (!insertError) return contactId;

  // 23505 = unique_violation: we lost the race. Any other error is fatal.
  if (insertError.code !== "23505") {
    throw new Error(
      `Could not cache Moneybird contact id for company ${company.id}: ${insertError.message}`,
    );
  }

  const { data: winner, error: reselectError } = await supabaseAdmin
    .from("moneybird_company_contacts")
    .select("contact_id")
    .eq("company_id", company.id)
    .eq("administration_id", credentials.administrationId)
    .maybeSingle();
  if (reselectError || !winner?.contact_id) {
    throw new Error(
      `Lost the contact-cache race for company ${company.id} but could not read the winning contact id: ${reselectError?.message ?? "no id"}`,
    );
  }
  if (!existing && winner.contact_id !== contactId) {
    console.error(
      `Orphaned Moneybird contact ${contactId} created for company ${company.id} due to a concurrent document; reusing ${winner.contact_id}. Manual cleanup of the orphan may be needed.`,
    );
  }
  return winner.contact_id;
};
