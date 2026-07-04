import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { listTaxRates } from "./moneybirdClient.ts";
import { createEstimateForDeal } from "./createEstimateForDeal.ts";
import { selectSalesTaxRates } from "./buildEstimatePayload.ts";

// The Moneybird administration is EUR-only; every estimate is created in EUR.
const ESTIMATE_CURRENCY = "EUR";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// The active sales-invoice tax rates — the single source of truth for both the
// dropdown (GET) and server-side validation (POST).
const loadSalesTaxRates = () => listTaxRates().then(selectSalesTaxRates);

// GET -> the sales-invoice tax rates the frontend offers in the estimate dialog.
// Fetched live (not hardcoded) so a future rate change in Moneybird flows
// through automatically. No side effects.
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

const handleCreateEstimate = async (
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

  // Validate the client-supplied tax rate against the live, active sales-invoice
  // rate set BEFORE claiming the deal or touching Moneybird. The amount comes
  // from the DB (not the client), so the tax rate is the one client-controlled
  // financial field — never trust it. This turns an opaque 500 / wrong-VAT
  // document into a clean 400, and a stale-dropdown rate id into a clear error.
  const salesRates = await loadSalesTaxRates();
  if (!salesRates.some((rate) => rate.id === taxRateId)) {
    return createErrorResponse(400, "Ongeldig of niet-toegestaan btw-tarief.");
  }

  const outcome = await createEstimateForDeal({
    dealId: Number(dealId),
    taxRateId,
    description: typeof description === "string" ? description : "",
    currency: ESTIMATE_CURRENCY,
    salesId,
  });

  switch (outcome.kind) {
    case "created":
      return jsonResponse({
        data: {
          estimateId: outcome.estimateId,
          status: "completed",
          alreadyExisted: outcome.alreadyExisted,
        },
      });
    case "already_completed":
      // Idempotent success: the deal already had an estimate (e.g. a double
      // click). Return it so the UI simply shows the existing one.
      return jsonResponse({
        data: {
          estimateId: outcome.estimateId,
          status: "completed",
          alreadyExisted: true,
        },
      });
    case "in_progress":
      return createErrorResponse(
        409,
        "Er wordt al een offerte voor dit deal aangemaakt. Probeer het zo opnieuw.",
      );
    case "not_found":
      return createErrorResponse(404, "Deal niet gevonden.");
  }
};

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
            return await handleCreateEstimate(req, currentUserSale.id);
          }
          return createErrorResponse(405, "Method Not Allowed");
        } catch (error) {
          console.error("moneybird_estimate failed:", error);
          return createErrorResponse(
            500,
            `Aanmaken van de Moneybird-offerte is mislukt: ${
              error instanceof Error ? error.message : "Onbekende fout"
            }`,
          );
        }
      }),
    ),
  ),
);
