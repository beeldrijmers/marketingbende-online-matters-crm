// Orchestrates creating a Moneybird document (estimate or invoice) for a CRM
// deal. Shared by both edge functions. Sequence:
//   claim (atomic) -> load company -> resolve contact (+cache) -> reconcile by
//   reference -> create document -> record result on the deal.
// Any failure after the claim is recorded on the deal as 'failed' with the
// message, so the UI can show it and the user can retry.

import { supabaseAdmin } from "../supabaseAdmin.ts";
import {
  claimDealForDocument,
  markDocumentCompleted,
  markDocumentFailed,
} from "./claim.ts";
import { findOrCreateMoneybirdContact } from "./contact.ts";
import { createDocument, findDocumentByReference } from "./client.ts";
import { buildDocumentPayload, documentReference } from "./payload.ts";
import type { DocumentKind } from "./types.ts";

export type CreateDocumentOutcome =
  | { kind: "created"; documentId: string; alreadyExisted: boolean }
  | { kind: "already_completed"; documentId: string }
  | { kind: "in_progress" }
  | { kind: "not_found" };

export const createDocumentForDeal = async ({
  documentKind,
  dealId,
  taxRateId,
  description,
  currency,
  salesId,
}: {
  documentKind: DocumentKind;
  dealId: number;
  taxRateId: string;
  description: string;
  currency: string;
  salesId: number;
}): Promise<CreateDocumentOutcome> => {
  const claim = await claimDealForDocument(documentKind, dealId, salesId);
  if (claim.outcome === "already_completed") {
    return { kind: "already_completed", documentId: claim.documentId };
  }
  if (claim.outcome === "in_progress") return { kind: "in_progress" };
  if (claim.outcome === "not_found") return { kind: "not_found" };

  const deal = claim.deal;
  try {
    if (!deal.company_id) {
      throw new Error(
        "Dit deal heeft geen gekoppeld bedrijf; kan geen document aanmaken.",
      );
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select(
        "id, name, address, zipcode, city, country, tax_identifier, moneybird_contact_id",
      )
      .eq("id", deal.company_id)
      .maybeSingle();
    if (companyError) {
      throw new Error(
        `Could not load company ${deal.company_id}: ${companyError.message}`,
      );
    }
    if (!company) {
      throw new Error(`Company ${deal.company_id} not found`);
    }

    const contactId = await findOrCreateMoneybirdContact(company);

    // Reconciliation: adopt a document a prior attempt may already have created
    // for this deal (network-timeout case) instead of creating a duplicate.
    const reference = documentReference(documentKind, dealId);
    const existing = await findDocumentByReference(documentKind, reference);

    const documentId = existing
      ? existing.id
      : (
          await createDocument(
            documentKind,
            buildDocumentPayload({
              kind: documentKind,
              deal: { id: deal.id, amount: deal.amount },
              contactId,
              taxRateId,
              description,
              currency,
            }),
          )
        ).id;

    await markDocumentCompleted(documentKind, dealId, documentId);
    return {
      kind: "created",
      documentId,
      alreadyExisted: Boolean(existing),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markDocumentFailed(documentKind, dealId, message);
    throw error;
  }
};
