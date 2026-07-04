// Resolve the Moneybird contact for a CRM company, creating it when needed.
// Shared by estimates and invoices — both use the same companies.moneybird_
// contact_id cache, so a company's contact is created at most once.
//
// Resolution order:
//   1. companies.moneybird_contact_id cache hit -> reuse (no API call)
//   2. find an existing Moneybird contact by company name -> adopt + cache
//   3. create a new Moneybird contact -> cache
//
// The id is cached IMMEDIATELY, independent of whether the document that follows
// succeeds, so a retry after a failed document call reuses the same contact.

import { supabaseAdmin } from "../supabaseAdmin.ts";
import { createContact, findContactByCompanyName } from "./client.ts";
import { buildContactPayload, type CompanyForContact } from "./payload.ts";

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

  // Conditional cache write-back. The per-deal claim serializes per DEAL, not
  // per COMPANY, so two deals of the same company can resolve a contact
  // concurrently and both arrive here with a null cache. The .is(..., null)
  // guard makes exactly one write win.
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

  // We lost the race: reuse the winner's contact so both documents reference the
  // same one. A freshly created loser contact is an orphan (no document
  // attached); we do NOT auto-delete from the live administration — a rare empty
  // contact is logged for manual cleanup.
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
      `Orphaned Moneybird contact ${contactId} created for company ${company.id} due to a concurrent document; reusing ${winner.moneybird_contact_id}. Manual cleanup of the orphan may be needed.`,
    );
  }
  return winner.moneybird_contact_id;
};
