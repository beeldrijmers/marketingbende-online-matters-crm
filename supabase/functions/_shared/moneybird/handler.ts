// Shared HTTP handler for the moneybird_estimate and moneybird_invoice edge
// functions. Each function's index.ts is a one-liner that calls
// serveMoneybirdDocument(kind); all the auth/routing/validation lives here once.
//
// Since the per-user integration, every request runs under the CALLER'S OWN
// Moneybird credentials: after the user is authenticated, their connection row
// is loaded and their personal API token decrypted. A user without a connection
// gets a 412 so the UI can point them to their profile page.

import { corsHeaders, OptionsMiddleware } from "../cors.ts";
import { createErrorResponse } from "../utils.ts";
import { AuthMiddleware, UserMiddleware } from "../authentication.ts";
import { getUserSale } from "../getUserSale.ts";
import { listTaxRates } from "./client.ts";
import { selectSalesTaxRates } from "./payload.ts";
import { createDocumentForDeal } from "./document.ts";
import {
  resolveMoneybirdCredentials,
  type MoneybirdCredentials,
} from "./credentials.ts";
import { userFacingMessage } from "./errors.ts";
import type { DocumentKind } from "./types.ts";

// Every administration used so far is EUR-only; every document is created in EUR.
const DOCUMENT_CURRENCY = "EUR";

// The message the frontend shows when the caller has not connected their own
// Moneybird administration yet. 412 Precondition Failed: authentication was
// fine, a required setup step is missing.
export const NOT_CONNECTED_STATUS = 412;
const NOT_CONNECTED_MESSAGE =
  "Je hebt nog geen Moneybird-administratie gekoppeld. Koppel je Moneybird via je profielpagina.";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// The active sales-invoice tax rates in the caller's administration — the
// single source of truth for both the dropdown (GET) and server-side
// validation (POST).
const loadSalesTaxRates = (credentials: MoneybirdCredentials) =>
  listTaxRates(credentials).then(selectSalesTaxRates);

const handleGetTaxRates = async (
  credentials: MoneybirdCredentials,
): Promise<Response> => {
  const salesRates = await loadSalesTaxRates(credentials);
  return jsonResponse({
    data: salesRates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      percentage: rate.percentage,
    })),
  });
};

const handleCreate = async (
  kind: DocumentKind,
  req: Request,
  salesId: number,
  credentials: MoneybirdCredentials,
  encKey: string,
): Promise<Response> => {
  // Parse in a dedicated try/catch: a malformed body must be a clean 400 and
  // must never reach the generic error logging (JSON.parse errors embed a
  // snippet of the raw body in their message).
  let body: { dealId?: unknown; taxRateId?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Ongeldige aanvraag.");
  }
  const { dealId, taxRateId, description } = body;

  // dealId must be a positive integer; anything else (NaN, decimals,
  // booleans) would otherwise surface as a Postgres bigint cast error deep in
  // the claim — a confusing 500 instead of a clean 400.
  const numericDealId = Number(dealId);
  if (
    dealId === undefined ||
    dealId === null ||
    typeof dealId === "boolean" ||
    !Number.isInteger(numericDealId) ||
    numericDealId <= 0
  ) {
    return createErrorResponse(400, "Ongeldige aanvraag.");
  }
  if (typeof taxRateId !== "string" || taxRateId.trim() === "") {
    return createErrorResponse(400, "Missing taxRateId");
  }

  // Validate the client tax rate against the live active sales-invoice set of
  // the caller's administration BEFORE claiming or touching Moneybird. The
  // amount comes from the DB, so the tax rate is the only client-controlled
  // financial field — never trust it.
  const salesRates = await loadSalesTaxRates(credentials);
  if (!salesRates.some((rate) => rate.id === taxRateId)) {
    return createErrorResponse(400, "Ongeldig of niet-toegestaan btw-tarief.");
  }

  const outcome = await createDocumentForDeal({
    documentKind: kind,
    dealId: numericDealId,
    taxRateId,
    description: typeof description === "string" ? description : "",
    currency: DOCUMENT_CURRENCY,
    salesId,
    credentials,
    encKey,
  });

  const noun = kind === "estimate" ? "offerte" : "factuur";
  switch (outcome.kind) {
    case "created":
      return jsonResponse({
        data: {
          documentId: outcome.documentId,
          status: "completed",
          alreadyExisted: outcome.alreadyExisted,
        },
      });
    case "already_completed":
      // Idempotent success: the deal already had a document (e.g. a double
      // click). Return it so the UI simply shows the existing one.
      return jsonResponse({
        data: {
          documentId: outcome.documentId,
          status: "completed",
          alreadyExisted: true,
        },
      });
    case "in_progress":
      return createErrorResponse(
        409,
        `Er wordt al een ${noun} voor dit deal aangemaakt. Probeer het zo opnieuw.`,
      );
    case "not_found":
      return createErrorResponse(404, "Deal niet gevonden.");
  }
};

export const serveMoneybirdDocument = (kind: DocumentKind): void => {
  const noun = kind === "estimate" ? "offerte" : "factuur";
  Deno.serve(async (req: Request) =>
    OptionsMiddleware(req, async (req) =>
      AuthMiddleware(req, async (req) =>
        UserMiddleware(req, async (req, user) => {
          const currentUserSale = await getUserSale(user!);
          if (!currentUserSale) {
            return createErrorResponse(401, "Unauthorized");
          }

          try {
            // Read per request (NOT at module load) so a missing secret is a
            // clear 500 instead of an import-time crash of the whole function.
            const encKey = Deno.env.get("MONEYBIRD_ENC_KEY");
            if (!encKey) {
              console.error("MONEYBIRD_ENC_KEY secret is not configured");
              return createErrorResponse(
                500,
                "De Moneybird-koppeling is niet goed geconfigureerd op de server.",
              );
            }

            const credentials = await resolveMoneybirdCredentials(
              currentUserSale.id,
              encKey,
            );
            if (!credentials) {
              return createErrorResponse(
                NOT_CONNECTED_STATUS,
                NOT_CONNECTED_MESSAGE,
              );
            }

            if (req.method === "GET") {
              return await handleGetTaxRates(credentials);
            }
            if (req.method === "POST") {
              return await handleCreate(
                kind,
                req,
                currentUserSale.id,
                credentials,
                encKey,
              );
            }
            return createErrorResponse(405, "Method Not Allowed");
          } catch (error) {
            // Full details go to the server log (and the deal's
            // moneybird_*_error column); the user only sees messages that
            // were written for them. Raw internal/API errors are English and
            // may embed technical identifiers — never show those.
            console.error(`moneybird ${kind} failed:`, error);
            return createErrorResponse(
              500,
              userFacingMessage(
                error,
                `Aanmaken van de Moneybird-${noun} is mislukt. Probeer het later opnieuw.`,
              ),
            );
          }
        }),
      ),
    ),
  );
};
