// Thin fetch wrapper around the Moneybird REST API v2. Shared by the estimate,
// invoice and connection functions. Since the integration became per-user,
// every call runs under explicit per-request credentials (the caller's
// personal API token + administration id) — there is deliberately NO
// module-level environment access here; this module holds NO business logic.

import type {
  DocumentKind,
  MoneybirdAdministration,
  MoneybirdContact,
  MoneybirdContactInput,
  MoneybirdDocument,
  MoneybirdDocumentInput,
  MoneybirdTaxRate,
} from "./types.ts";
import type { MoneybirdCredentials } from "./credentials.ts";

const API_ROOT = "https://moneybird.com/api/v2";

// Hard cap per Moneybird call. Keeps a hung connection from pinning a deal
// claim anywhere near the STALE_CLAIM_MS window (claim.ts), which must only
// ever demote claims of provably dead isolates.
const FETCH_TIMEOUT_MS = 60 * 1000;

// The REST collection path per document kind.
const collectionPath = (kind: DocumentKind): string =>
  kind === "estimate" ? "estimates" : "sales_invoices";

const moneybirdFetch = async <T>(
  apiToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Moneybird ${init?.method ?? "GET"} ${url.slice(API_ROOT.length + 1)} failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
};

// Administration-scoped fetch: all document/contact/tax-rate endpoints live
// under /api/v2/{administrationId}/.
const administrationFetch = <T>(
  credentials: MoneybirdCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> =>
  moneybirdFetch<T>(
    credentials.apiToken,
    `${API_ROOT}/${credentials.administrationId}/${path}`,
    init,
  );

// The administrations a token can access. This is the only endpoint that is
// NOT administration-scoped; it doubles as the connect-time token validation
// (an invalid token yields a 401 from Moneybird).
export const listAdministrations = (
  apiToken: string,
): Promise<MoneybirdAdministration[]> =>
  moneybirdFetch<MoneybirdAdministration[]>(
    apiToken,
    `${API_ROOT}/administrations.json`,
  );

export const listTaxRates = (
  credentials: MoneybirdCredentials,
): Promise<MoneybirdTaxRate[]> =>
  administrationFetch<MoneybirdTaxRate[]>(credentials, "tax_rates.json");

// Best-effort lookup of an existing contact by an exact (case-insensitive)
// company_name match. Null when nothing matches — the caller then creates one.
export const findContactByCompanyName = async (
  credentials: MoneybirdCredentials,
  name: string,
): Promise<MoneybirdContact | null> => {
  const contacts = await administrationFetch<MoneybirdContact[]>(
    credentials,
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
  credentials: MoneybirdCredentials,
  payload: MoneybirdContactInput,
): Promise<MoneybirdContact> =>
  administrationFetch<MoneybirdContact>(credentials, "contacts.json", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createDocument = (
  credentials: MoneybirdCredentials,
  kind: DocumentKind,
  payload: MoneybirdDocumentInput,
): Promise<MoneybirdDocument> =>
  administrationFetch<MoneybirdDocument>(
    credentials,
    `${collectionPath(kind)}.json`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const getDocument = (
  credentials: MoneybirdCredentials,
  kind: DocumentKind,
  documentId: string,
): Promise<MoneybirdDocument> =>
  administrationFetch<MoneybirdDocument>(
    credentials,
    `${collectionPath(kind)}/${encodeURIComponent(documentId)}.json`,
  );

export const listDocuments = (
  credentials: MoneybirdCredentials,
  kind: DocumentKind,
  page = 1,
  perPage = 100,
): Promise<MoneybirdDocument[]> =>
  administrationFetch<MoneybirdDocument[]>(
    credentials,
    `${collectionPath(kind)}.json?per_page=${Math.min(Math.max(perPage, 1), 100)}&page=${Math.max(page, 1)}`,
  );

// Reconciliation guard for the "our create landed at Moneybird but the response
// never reached us" case: find a document we previously created for this deal by
// its deterministic reference. There is no server-side reference filter, so we
// page recent documents and match client-side. Runs under the caller's
// credentials, so it only ever sees (and adopts) documents in the caller's own
// administration.
//
// Failure mode is caller-chosen via `strict`:
//   - strict=false (first attempt, nothing can exist yet): a listing failure is
//     logged and treated as "no document" — it must never block a normal
//     creation.
//   - strict=true (a PREVIOUS attempt failed, a real document may exist): a
//     listing failure ABORTS the attempt. Proceeding to create here is exactly
//     the double-document scenario this reconciliation exists to prevent.
export const findDocumentByReference = async (
  credentials: MoneybirdCredentials,
  kind: DocumentKind,
  reference: string,
  { strict }: { strict: boolean },
): Promise<MoneybirdDocument | null> => {
  const perPage = 100;
  const maxPages = 3;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const documents = await listDocuments(credentials, kind, page, perPage);
      const match = documents.find(
        (document) => document.reference === reference,
      );
      if (match) return match;
      if (documents.length < perPage) break; // last page reached
    }
  } catch (error) {
    if (strict) {
      throw new Error(
        `Could not verify whether an earlier ${kind} already exists (reference ${reference}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    console.error(
      `moneybird findDocumentByReference(${kind}) failed (best-effort):`,
      error,
    );
  }
  return null;
};
