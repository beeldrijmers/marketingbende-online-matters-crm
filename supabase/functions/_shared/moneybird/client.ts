// Thin fetch wrapper around the Moneybird REST API v2. Shared by the estimate
// and invoice functions. Env vars are checked at MODULE LOAD time (a
// misconfigured secret crashes the function on import, never mid-request);
// every call throws on a non-2xx response with the status plus the body; this
// module holds NO business logic.

import type {
  DocumentKind,
  MoneybirdContact,
  MoneybirdContactInput,
  MoneybirdDocument,
  MoneybirdDocumentInput,
  MoneybirdTaxRate,
} from "./types.ts";

const apiToken = Deno.env.get("MONEYBIRD_API_TOKEN");
const adminId = Deno.env.get("MONEYBIRD_ADMIN_ID");
if (!apiToken || !adminId) {
  throw new Error(
    "Missing MONEYBIRD_API_TOKEN or MONEYBIRD_ADMIN_ID env variable",
  );
}

const baseUrl = `https://moneybird.com/api/v2/${adminId}`;

// The REST collection path per document kind.
const collectionPath = (kind: DocumentKind): string =>
  kind === "estimate" ? "estimates" : "sales_invoices";

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

export const listTaxRates = (): Promise<MoneybirdTaxRate[]> =>
  moneybirdFetch<MoneybirdTaxRate[]>("tax_rates.json");

// Best-effort lookup of an existing contact by an exact (case-insensitive)
// company_name match. Null when nothing matches — the caller then creates one.
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

export const createDocument = (
  kind: DocumentKind,
  payload: MoneybirdDocumentInput,
): Promise<MoneybirdDocument> =>
  moneybirdFetch<MoneybirdDocument>(`${collectionPath(kind)}.json`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Reconciliation guard for the "our create landed at Moneybird but the response
// never reached us" case: find a document we previously created for this deal by
// its deterministic reference. There is no server-side reference filter, so we
// page recent documents and match client-side. BEST-EFFORT: a listing failure
// must never block a normal creation, so on any error we log and return null
// (the atomic deal claim + the partial-unique index remain the primary
// idempotency guarantees).
export const findDocumentByReference = async (
  kind: DocumentKind,
  reference: string,
): Promise<MoneybirdDocument | null> => {
  const perPage = 100;
  const maxPages = 3;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const documents = await moneybirdFetch<MoneybirdDocument[]>(
        `${collectionPath(kind)}.json?per_page=${perPage}&page=${page}`,
      );
      const match = documents.find(
        (document) => document.reference === reference,
      );
      if (match) return match;
      if (documents.length < perPage) break; // last page reached
    }
  } catch (error) {
    console.error(
      `moneybird findDocumentByReference(${kind}) failed (best-effort):`,
      error,
    );
  }
  return null;
};
