// Atomic, race-safe claim of a deal for Moneybird document creation, shared by
// estimates and invoices (only the column set differs).
//
// Why a claim: this creates a REAL financial document. A double-click, a second
// tab, or Supabase's automatic retry must NEVER create two documents. The only
// race-safe primitive is a single conditional UPDATE ... WHERE guard, expressed
// here with PostgREST filters (no extra DB function needed).
//
// A deal is claimable for a given kind when that kind's status is:
//   - null      -> never attempted
//   - 'failed'  -> a previous attempt failed; a retry is allowed
//   - 'pending' but claimed_at older than the stale window -> the previous
//     attempt's isolate was hard-killed mid-request and will never finish.
// A 'completed' deal is never re-claimed (it already has a document id).

import { supabaseAdmin } from "../supabaseAdmin.ts";
import type { DocumentKind } from "./types.ts";

const STALE_CLAIM_MS = 5 * 60 * 1000;

// The deals column set per document kind.
const COLUMNS = {
  estimate: {
    id: "moneybird_estimate_id",
    status: "moneybird_estimate_status",
    claimedAt: "moneybird_estimate_claimed_at",
    createdBy: "moneybird_estimate_created_by",
    error: "moneybird_estimate_error",
  },
  invoice: {
    id: "moneybird_invoice_id",
    status: "moneybird_invoice_status",
    claimedAt: "moneybird_invoice_claimed_at",
    createdBy: "moneybird_invoice_created_by",
    error: "moneybird_invoice_error",
  },
} as const;

export interface ClaimedDeal {
  id: number;
  company_id: number | null;
  name: string;
  amount: number | null;
  description: string | null;
}

export type ClaimResult =
  | { outcome: "claimed"; deal: ClaimedDeal }
  | { outcome: "already_completed"; documentId: string }
  | { outcome: "in_progress" }
  | { outcome: "not_found" };

export const claimDealForDocument = async (
  kind: DocumentKind,
  dealId: number | string,
  salesId: number,
): Promise<ClaimResult> => {
  const cols = COLUMNS[kind];

  // Step 1 — demote a stale 'pending' claim back to 'failed'. This is NOT the
  // concurrency gate (step 2 is); computing the threshold in JS lets us express
  // the time comparison as a plain PostgREST filter. Only genuinely abandoned
  // claims are demoted, so a live in-flight request is never disturbed.
  const staleThreshold = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { error: staleError } = await supabaseAdmin
    .from("deals")
    .update({ [cols.status]: "failed" })
    .eq("id", dealId)
    .eq(cols.status, "pending")
    .lt(cols.claimedAt, staleThreshold);
  if (staleError) {
    throw new Error(
      `Could not reset a stale ${kind} claim on deal ${dealId}: ${staleError.message}`,
    );
  }

  // Step 2 — the atomic claim. Exactly one concurrent caller can flip a
  // (null | 'failed') status to 'pending'; a losing caller matches no row.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("deals")
    .update({
      [cols.status]: "pending",
      [cols.claimedAt]: new Date().toISOString(),
      [cols.createdBy]: salesId,
      [cols.error]: null,
    })
    .eq("id", dealId)
    .or(`${cols.status}.is.null,${cols.status}.eq.failed`)
    .select("id, company_id, name, amount, description")
    .maybeSingle();
  if (claimError) {
    throw new Error(
      `Could not claim deal ${dealId} for a ${kind}: ${claimError.message}`,
    );
  }
  if (claimed) {
    return { outcome: "claimed", deal: claimed as ClaimedDeal };
  }

  // We did not win the claim. Read the current state to explain why.
  const { data: current, error: readError } = await supabaseAdmin
    .from("deals")
    .select(cols.id)
    .eq("id", dealId)
    .maybeSingle();
  if (readError) {
    throw new Error(
      `Could not read deal ${dealId} after a failed ${kind} claim: ${readError.message}`,
    );
  }
  if (!current) return { outcome: "not_found" };
  const existingId = (current as Record<string, string | null>)[cols.id];
  if (existingId) {
    return { outcome: "already_completed", documentId: existingId };
  }
  return { outcome: "in_progress" };
};

export const markDocumentCompleted = async (
  kind: DocumentKind,
  dealId: number | string,
  documentId: string,
): Promise<void> => {
  const cols = COLUMNS[kind];
  const { error } = await supabaseAdmin
    .from("deals")
    .update({
      [cols.id]: documentId,
      [cols.status]: "completed",
      [cols.error]: null,
    })
    .eq("id", dealId);
  if (error) {
    // The document exists in Moneybird but we could not record it. Surface it
    // loudly; the reference reconciliation adopts the existing document on retry
    // instead of creating a duplicate.
    throw new Error(
      `${kind} ${documentId} was created but could not be linked to deal ${dealId}: ${error.message}`,
    );
  }
};

export const markDocumentFailed = async (
  kind: DocumentKind,
  dealId: number | string,
  message: string,
): Promise<void> => {
  const cols = COLUMNS[kind];
  const { error } = await supabaseAdmin
    .from("deals")
    .update({
      [cols.status]: "failed",
      [cols.error]: message.slice(0, 1000),
    })
    .eq("id", dealId);
  if (error) {
    throw new Error(
      `Could not record the ${kind} failure on deal ${dealId}: ${error.message}`,
    );
  }
};
