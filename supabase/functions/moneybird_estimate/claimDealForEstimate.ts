// Atomic, race-safe claim of a deal for Moneybird estimate creation.
//
// Why a claim at all: this creates a REAL financial document. A double-click, a
// second browser tab, or Supabase's automatic retry must NEVER result in two
// Moneybird estimates. The repo's default select-then-insert style
// (findOrCreateCompany) is NOT race-safe; the only race-safe primitive is a
// single conditional UPDATE ... WHERE guard (archiveDealByCardId). We build on
// that, using PostgREST filters so no extra DB function is needed.
//
// A deal is claimable when its estimate status is:
//   - null      -> never attempted
//   - 'failed'  -> a previous attempt failed; a retry is allowed
//   - 'pending' but claimed_at is older than the stale window -> the previous
//     attempt's isolate was hard-killed mid-request and will never finish.
// A 'completed' deal is never re-claimed (it already has an estimate id).

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// How long a 'pending' claim may sit before we consider the owning request dead
// and allow another to take over. Comfortably longer than any Moneybird round
// trip, so a legitimately in-flight request is never stolen.
const STALE_CLAIM_MS = 5 * 60 * 1000;

export interface ClaimedDeal {
  id: number;
  company_id: number | null;
  name: string;
  amount: number | null;
  description: string | null;
  moneybird_estimate_id: string | null;
}

export type ClaimResult =
  | { outcome: "claimed"; deal: ClaimedDeal }
  | { outcome: "already_completed"; estimateId: string }
  | { outcome: "in_progress" }
  | { outcome: "not_found" };

export const claimDealForEstimate = async (
  dealId: number | string,
  salesId: number,
): Promise<ClaimResult> => {
  // Step 1 — demote a stale 'pending' claim back to 'failed'. This is a
  // separate statement, but it is NOT the concurrency gate: the atomic claim in
  // step 2 is. Computing the threshold in JS (rather than SQL now()) lets us
  // express the time comparison as a plain PostgREST filter. Only genuinely
  // abandoned claims (older than the window) are demoted, so a live in-flight
  // request is never disturbed.
  const staleThreshold = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { error: staleError } = await supabaseAdmin
    .from("deals")
    .update({ moneybird_estimate_status: "failed" })
    .eq("id", dealId)
    .eq("moneybird_estimate_status", "pending")
    .lt("moneybird_estimate_claimed_at", staleThreshold);
  if (staleError) {
    throw new Error(
      `Could not reset a stale estimate claim on deal ${dealId}: ${staleError.message}`,
    );
  }

  // Step 2 — the atomic claim. Exactly one concurrent caller can flip a
  // (null | 'failed') status to 'pending'; a losing caller matches no row and
  // gets data === null.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("deals")
    .update({
      moneybird_estimate_status: "pending",
      moneybird_estimate_claimed_at: new Date().toISOString(),
      moneybird_estimate_created_by: salesId,
      moneybird_estimate_error: null,
    })
    .eq("id", dealId)
    .or("moneybird_estimate_status.is.null,moneybird_estimate_status.eq.failed")
    .select("id, company_id, name, amount, description, moneybird_estimate_id")
    .maybeSingle();
  if (claimError) {
    throw new Error(
      `Could not claim deal ${dealId} for an estimate: ${claimError.message}`,
    );
  }
  if (claimed) {
    return { outcome: "claimed", deal: claimed as ClaimedDeal };
  }

  // We did not win the claim. Read the current state to explain why with a
  // useful, distinct message (already created vs. being created right now).
  const { data: current, error: readError } = await supabaseAdmin
    .from("deals")
    .select("moneybird_estimate_id")
    .eq("id", dealId)
    .maybeSingle();
  if (readError) {
    throw new Error(
      `Could not read deal ${dealId} after a failed claim: ${readError.message}`,
    );
  }
  if (!current) return { outcome: "not_found" };
  if (current.moneybird_estimate_id) {
    return {
      outcome: "already_completed",
      estimateId: current.moneybird_estimate_id,
    };
  }
  return { outcome: "in_progress" };
};

export const markEstimateCompleted = async (
  dealId: number | string,
  estimateId: string,
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({
      moneybird_estimate_id: estimateId,
      moneybird_estimate_status: "completed",
      moneybird_estimate_error: null,
    })
    .eq("id", dealId);
  if (error) {
    // The estimate exists in Moneybird but we could not record it. Surface it
    // loudly rather than swallowing — the reference reconciliation will adopt
    // the existing estimate on a retry instead of creating a duplicate.
    throw new Error(
      `Estimate ${estimateId} was created but could not be linked to deal ${dealId}: ${error.message}`,
    );
  }
};

export const markEstimateFailed = async (
  dealId: number | string,
  message: string,
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({
      moneybird_estimate_status: "failed",
      // Truncate to keep a runaway API body out of the column; the full error
      // is also logged server-side.
      moneybird_estimate_error: message.slice(0, 1000),
    })
    .eq("id", dealId);
  if (error) {
    throw new Error(
      `Could not record the estimate failure on deal ${dealId}: ${error.message}`,
    );
  }
};
