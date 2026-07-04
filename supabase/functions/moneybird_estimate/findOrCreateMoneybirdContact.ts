// Resolve the Moneybird contact for a CRM company, creating it when needed.
//
// Resolution order:
//   1. companies.moneybird_contact_id cache hit  -> reuse (no API call)
//   2. find an existing Moneybird contact by company name -> adopt + cache
//   3. create a new Moneybird contact -> cache
//
// The resolved id is written back to companies.moneybird_contact_id IMMEDIATELY,
// independent of whether the estimate that follows succeeds. That way a retry
// after a failed estimate call reuses the same contact instead of creating a
// duplicate one.

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createContact, findContactByCompanyName } from "./moneybirdClient.ts";
import {
  buildContactPayload,
  type CompanyForContact,
} from "./buildEstimatePayload.ts";

interface CompanyRow extends CompanyForContact {
  id: number;
  moneybird_contact_id: string | null;
}

export const findOrCreateMoneybirdContact = async (
  company: CompanyRow,
): Promise<string> => {
  if (company.moneybird_contact_id) {
    return company.moneybird_contact_id;
  }

  const existing = await findContactByCompanyName(company.name);
  const contactId = existing
    ? existing.id
    : (await createContact(buildContactPayload(company))).id;

  // Conditional cache write-back. The per-deal claim in claimDealForEstimate.ts
  // serializes per DEAL, not per COMPANY, so two deals of the same company can
  // resolve a contact concurrently and both arrive here with a null cache. The
  // .is(..., null) guard makes exactly one write win.
  const { data: won, error } = await supabaseAdmin
    .from("companies")
    .update({ moneybird_contact_id: contactId })
    .eq("id", company.id)
    .is("moneybird_contact_id", null)
    .select("moneybird_contact_id")
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not cache Moneybird contact id on company ${company.id}: ${error.message}`,
    );
  }
  if (won) return contactId;

  // We lost the race: a concurrent request cached a contact first. Reuse THAT
  // id so both estimates reference the same Moneybird contact. If we had just
  // created a new contact it is now an orphan (no estimate attached). We do NOT
  // auto-delete from the live administration — a rare empty contact is logged
  // for manual cleanup instead (matches the plan's accepted known limitation).
  const { data: winner, error: reselectError } = await supabaseAdmin
    .from("companies")
    .select("moneybird_contact_id")
    .eq("id", company.id)
    .maybeSingle();
  if (reselectError || !winner?.moneybird_contact_id) {
    throw new Error(
      `Lost the contact-cache race for company ${company.id} but could not read the winning contact id: ${reselectError?.message ?? "no id"}`,
    );
  }
  if (!existing && winner.moneybird_contact_id !== contactId) {
    console.error(
      `Orphaned Moneybird contact ${contactId} created for company ${company.id} due to a concurrent estimate; reusing ${winner.moneybird_contact_id}. Manual cleanup of the orphan may be needed.`,
    );
  }
  return winner.moneybird_contact_id;
};
