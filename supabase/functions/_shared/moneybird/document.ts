// Orchestrates creating a Moneybird document (estimate or invoice) for a CRM
// deal, in the CALLER'S OWN administration (per-user credentials). Shared by
// both edge functions. Sequence:
//   claim (atomic) -> load company -> resolve contact (+cache per
//   administration) -> reconcile by reference -> create document -> record
//   result (including the administration) on the deal.
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
import {
  resolveCredentialsForAdministration,
  type MoneybirdCredentials,
} from "./credentials.ts";
import type { DocumentKind } from "./types.ts";

export type CreateDocumentOutcome =
  | { kind: "created"; documentId: string; alreadyExisted: boolean }
  | { kind: "already_completed"; documentId: string }
  | { kind: "in_progress" }
  | { kind: "not_found" };

// Reconciliation across administrations: a previous attempt by ANOTHER user
// ran against a different administration and failed after its Moneybird create
// may have landed. Look for the deal's deterministic reference there (using any
// still-existing connection to that administration) so we adopt that document
// instead of creating a second real one in our own administration. Best-effort:
// when nobody is connected to the old administration anymore we log and move
// on (the possible stray document there cannot be seen by anyone in the CRM).
const findDocumentInPreviousAdministration = async (
  documentKind: DocumentKind,
  dealId: number,
  previousAdministrationId: string,
  encKey: string,
): Promise<{ documentId: string; administrationId: string } | null> => {
  const previousCredentials = await resolveCredentialsForAdministration(
    previousAdministrationId,
    encKey,
  );
  if (!previousCredentials) {
    console.error(
      `moneybird ${documentKind} retry for deal ${dealId}: previous attempt ran in administration ${previousAdministrationId} but no connection to it exists anymore; cannot reconcile there. A stray document may exist in that administration.`,
    );
    return null;
  }
  const existing = await findDocumentByReference(
    previousCredentials,
    documentKind,
    documentReference(documentKind, dealId),
  );
  return existing
    ? { documentId: existing.id, administrationId: previousAdministrationId }
    : null;
};

export const createDocumentForDeal = async ({
  documentKind,
  dealId,
  taxRateId,
  description,
  currency,
  salesId,
  credentials,
  encKey,
}: {
  documentKind: DocumentKind;
  dealId: number;
  taxRateId: string;
  description: string;
  currency: string;
  salesId: number;
  credentials: MoneybirdCredentials;
  encKey: string;
}): Promise<CreateDocumentOutcome> => {
  const claim = await claimDealForDocument(documentKind, dealId, salesId);
  if (claim.outcome === "already_completed") {
    return { kind: "already_completed", documentId: claim.documentId };
  }
  if (claim.outcome === "in_progress") return { kind: "in_progress" };
  if (claim.outcome === "not_found") return { kind: "not_found" };

  const deal = claim.deal;
  try {
    // A failed attempt in a DIFFERENT administration may have created a real
    // document there; adopt it rather than duplicating it in our own.
    if (
      claim.previousAdministrationId &&
      claim.previousAdministrationId !== credentials.administrationId
    ) {
      const adopted = await findDocumentInPreviousAdministration(
        documentKind,
        dealId,
        claim.previousAdministrationId,
        encKey,
      );
      if (adopted) {
        await markDocumentCompleted(
          documentKind,
          dealId,
          adopted.documentId,
          adopted.administrationId,
        );
        return {
          kind: "created",
          documentId: adopted.documentId,
          alreadyExisted: true,
        };
      }
    }
    if (!deal.company_id) {
      throw new Error(
        "Dit deal heeft geen gekoppeld bedrijf; kan geen document aanmaken.",
      );
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, address, zipcode, city, country, tax_identifier")
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

    const contactId = await findOrCreateMoneybirdContact(credentials, company);

    // Reconciliation: adopt a document a prior attempt may already have created
    // for this deal (network-timeout case) instead of creating a duplicate.
    // Scoped to the caller's administration by the credentials.
    const reference = documentReference(documentKind, dealId);
    const existing = await findDocumentByReference(
      credentials,
      documentKind,
      reference,
    );

    const documentId = existing
      ? existing.id
      : (
          await createDocument(
            credentials,
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

    await markDocumentCompleted(
      documentKind,
      dealId,
      documentId,
      credentials.administrationId,
    );
    return {
      kind: "created",
      documentId,
      alreadyExisted: Boolean(existing),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markDocumentFailed(
      documentKind,
      dealId,
      message,
      credentials.administrationId,
    );
    throw error;
  }
};
