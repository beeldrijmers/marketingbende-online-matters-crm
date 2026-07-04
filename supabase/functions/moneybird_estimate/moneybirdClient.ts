// Thin fetch wrapper around the Moneybird REST API v2.
//
// Mirrors trello-sync/fetchTrelloCard.ts: the required env vars are checked at
// MODULE LOAD time (so a misconfigured secret crashes the function on import,
// never mid-request), every call throws on a non-2xx response with the status
// plus the response body, and this module holds NO business logic — payloads
// are built by the pure buildEstimatePayload.ts module.

import type {
  MoneybirdContact,
  MoneybirdContactInput,
  MoneybirdEstimate,
  MoneybirdEstimateInput,
  MoneybirdTaxRate,
} from "./moneybirdTypes.ts";

const apiToken = Deno.env.get("MONEYBIRD_API_TOKEN");
const adminId = Deno.env.get("MONEYBIRD_ADMIN_ID");
if (!apiToken || !adminId) {
  throw new Error(
    "Missing MONEYBIRD_API_TOKEN or MONEYBIRD_ADMIN_ID env variable",
  );
}

const baseUrl = `https://moneybird.com/api/v2/${adminId}`;

const moneybirdFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${baseUrl}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Moneybird ${init?.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
};

// List every tax rate. Callers filter to sales_invoice-type rates themselves.
export const listTaxRates = (): Promise<MoneybirdTaxRate[]> =>
  moneybirdFetch<MoneybirdTaxRate[]>("tax_rates.json");

// Best-effort lookup of an existing contact by company name. Returns a contact
// only when its company_name matches exactly (case-insensitive) to avoid
// false-positive matches on a partial search. Null when nothing matches — the
// caller then creates a new contact. This is only used the first time a company
// gets an estimate; afterwards companies.moneybird_contact_id is the cache.
export const findContactByCompanyName = async (
  name: string,
): Promise<MoneybirdContact | null> => {
  const contacts = await moneybirdFetch<MoneybirdContact[]>(
    `contacts.json?query=${encodeURIComponent(name)}`,
  );
  const normalized = name.trim().toLowerCase();
  return (
    contacts.find(
      (contact) =>
        (contact.company_name ?? "").trim().toLowerCase() === normalized,
    ) ?? null
  );
};

export const createContact = (
  payload: MoneybirdContactInput,
): Promise<MoneybirdContact> =>
  moneybirdFetch<MoneybirdContact>("contacts.json", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Reconciliation guard for the "our create landed at Moneybird but the response
// never reached us" case: find an estimate we previously created for this deal
// by its deterministic reference. Moneybird's list endpoint has no server-side
// reference filter, so we page recent estimates and match client-side. Bounded
// to a few pages because these references are unique per deal and there are few
// estimates in this administration.
//
// This is a BEST-EFFORT guard, so a listing failure must never block a normal
// creation: on any error we log and return null (proceed to create). The
// primary idempotency guarantees are the atomic deal claim and the partial-
// unique index on deals.moneybird_estimate_id — this only prevents a duplicate
// in the narrow network-timeout window. Returns null when nothing matches.
export const findEstimateByReference = async (
  reference: string,
): Promise<MoneybirdEstimate | null> => {
  const perPage = 100;
  const maxPages = 3;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const estimates = await moneybirdFetch<MoneybirdEstimate[]>(
        `estimates.json?per_page=${perPage}&page=${page}`,
      );
      const match = estimates.find(
        (estimate) => estimate.reference === reference,
      );
      if (match) return match;
      if (estimates.length < perPage) break; // last page reached
    }
  } catch (error) {
    console.error(
      "moneybird findEstimateByReference failed (best-effort):",
      error,
    );
  }
  return null;
};

export const createEstimate = (
  payload: MoneybirdEstimateInput,
): Promise<MoneybirdEstimate> =>
  moneybirdFetch<MoneybirdEstimate>("estimates.json", {
    method: "POST",
    body: JSON.stringify(payload),
  });
