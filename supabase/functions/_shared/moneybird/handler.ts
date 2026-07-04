// Shared HTTP handler for the moneybird_estimate and moneybird_invoice edge
// functions. Each function's index.ts is a one-liner that calls
// serveMoneybirdDocument(kind); all the auth/routing/validation lives here once.

import { corsHeaders, OptionsMiddleware } from "../cors.ts";
import { createErrorResponse } from "../utils.ts";
import { AuthMiddleware, UserMiddleware } from "../authentication.ts";
import { getUserSale } from "../getUserSale.ts";
import { listTaxRates } from "./client.ts";
import { selectSalesTaxRates } from "./payload.ts";
import { createDocumentForDeal } from "./document.ts";
import type { DocumentKind } from "./types.ts";

// The Moneybird administration is EUR-only; every document is created in EUR.
const DOCUMENT_CURRENCY = "EUR";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// The active sales-invoice tax rates — the single source of truth for both the
// dropdown (GET) and server-side validation (POST).
const loadSalesTaxRates = () => listTaxRates().then(selectSalesTaxRates);

const handleGetTaxRates = async (): Promise<Response> => {
  const salesRates = await loadSalesTaxRates();
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
): Promise<Response> => {
  const { dealId, taxRateId, description } = await req.json();

  if (dealId === undefined || dealId === null) {
    return createErrorResponse(400, "Missing dealId");
  }
  if (typeof taxRateId !== "string" || taxRateId.trim() === "") {
    return createErrorResponse(400, "Missing taxRateId");
  }

  // Validate the client tax rate against the live active sales-invoice set
  // BEFORE claiming or touching Moneybird. The amount comes from the DB, so the
  // tax rate is the only client-controlled financial field — never trust it.
  const salesRates = await loadSalesTaxRates();
  if (!salesRates.some((rate) => rate.id === taxRateId)) {
    return createErrorResponse(400, "Ongeldig of niet-toegestaan btw-tarief.");
  }

  const outcome = await createDocumentForDeal({
    documentKind: kind,
    dealId: Number(dealId),
    taxRateId,
    description: typeof description === "string" ? description : "",
    currency: DOCUMENT_CURRENCY,
    salesId,
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
            if (req.method === "GET") {
              return await handleGetTaxRates();
            }
            if (req.method === "POST") {
              return await handleCreate(kind, req, currentUserSale.id);
            }
            return createErrorResponse(405, "Method Not Allowed");
          } catch (error) {
            console.error(`moneybird ${kind} failed:`, error);
            return createErrorResponse(
              500,
              `Aanmaken van de Moneybird-${noun} is mislukt: ${
                error instanceof Error ? error.message : "Onbekende fout"
              }`,
            );
          }
        }),
      ),
    ),
  );
};
