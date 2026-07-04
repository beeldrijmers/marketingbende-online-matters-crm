// Orchestrates creating a Moneybird estimate for a CRM deal. Kept out of
// index.ts so the HTTP layer stays thin. Sequence:
//   claim (atomic) -> load company -> resolve contact (+cache) -> reconcile by
//   reference -> create estimate -> record result on the deal.
// Any failure after the claim is recorded on the deal as 'failed' with the
// message, so the UI can show it and the user can retry.

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  claimDealForEstimate,
  markEstimateCompleted,
  markEstimateFailed,
} from "./claimDealForEstimate.ts";
import { findOrCreateMoneybirdContact } from "./findOrCreateMoneybirdContact.ts";
import { createEstimate, findEstimateByReference } from "./moneybirdClient.ts";
import {
  buildEstimatePayload,
  estimateReference,
} from "./buildEstimatePayload.ts";

export type CreateEstimateOutcome =
  | {
      kind: "created";
      estimateId: string;
      alreadyExisted: boolean;
    }
  | { kind: "already_completed"; estimateId: string }
  | { kind: "in_progress" }
  | { kind: "not_found" };

export const createEstimateForDeal = async ({
  dealId,
  taxRateId,
  description,
  currency,
  salesId,
}: {
  dealId: number;
  taxRateId: string;
  description: string;
  currency: string;
  salesId: number;
}): Promise<CreateEstimateOutcome> => {
  const claim = await claimDealForEstimate(dealId, salesId);
  if (claim.outcome === "already_completed") {
    return { kind: "already_completed", estimateId: claim.estimateId };
  }
  if (claim.outcome === "in_progress") return { kind: "in_progress" };
  if (claim.outcome === "not_found") return { kind: "not_found" };

  const deal = claim.deal;
  try {
    if (!deal.company_id) {
      throw new Error(
        "Dit deal heeft geen gekoppeld bedrijf; kan geen offerte aanmaken.",
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

    // Reconciliation: adopt an estimate a prior attempt may already have created
    // for this deal (network-timeout case) instead of creating a duplicate.
    const reference = estimateReference(dealId);
    const existing = await findEstimateByReference(reference);

    const estimateId = existing
      ? existing.id
      : (
          await createEstimate(
            buildEstimatePayload({
              deal: { id: deal.id, amount: deal.amount },
              contactId,
              taxRateId,
              description,
              currency,
            }),
          )
        ).id;

    await markEstimateCompleted(dealId, estimateId);
    return {
      kind: "created",
      estimateId,
      alreadyExisted: Boolean(existing),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markEstimateFailed(dealId, message);
    throw error;
  }
};
