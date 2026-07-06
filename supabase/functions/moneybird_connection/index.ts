// Connect or disconnect the caller's OWN Moneybird administration.
//
//   POST   { apiToken, administrationId? } -> validate the personal API token
//          live against Moneybird, pick the administration (implicit when the
//          token has exactly one), encrypt the token with AES-256-GCM and
//          upsert the caller's moneybird_connections row.
//   DELETE -> remove the caller's connection.
//
// Connection STATUS is not served here: the client reads its own row directly
// (RLS owner-only; the token column is not readable by client roles).
//
// The plaintext token only ever lives in this request's memory; it is never
// logged and never returned.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { listAdministrations } from "../_shared/moneybird/client.ts";
import {
  connectionAad,
  encryptToken,
} from "../_shared/moneybird/tokenCrypto.ts";
import { chooseAdministration } from "./chooseAdministration.ts";

// Personal Moneybird tokens are ~64 chars; anything wildly longer is not a
// token. Guards the encrypt/store path against garbage input.
const MAX_TOKEN_LENGTH = 200;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handleConnect = async (
  req: Request,
  salesId: number,
  encKey: string,
): Promise<Response> => {
  // Parse in a dedicated try/catch: a malformed body must be a clean 400 and
  // must never reach the generic error logging (JSON.parse errors embed a
  // snippet of the raw body — potentially the plaintext token — in their
  // message).
  let body: { apiToken?: unknown; administrationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Ongeldige aanvraag.");
  }
  const { apiToken, administrationId } = body;

  if (typeof apiToken !== "string" || apiToken.trim() === "") {
    return createErrorResponse(400, "Vul een Moneybird API-token in.");
  }
  if (apiToken.length > MAX_TOKEN_LENGTH) {
    return createErrorResponse(400, "Dit is geen geldig Moneybird API-token.");
  }
  if (
    administrationId !== undefined &&
    (typeof administrationId !== "string" || administrationId.trim() === "")
  ) {
    return createErrorResponse(400, "Ongeldige administratie-id.");
  }

  const trimmedToken = apiToken.trim();

  // Live validation doubling as discovery: an invalid/revoked token cannot
  // list administrations.
  let administrations;
  try {
    administrations = await listAdministrations(trimmedToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("failed: 401")) {
      return createErrorResponse(
        400,
        "Moneybird accepteert dit API-token niet. Controleer of je het volledige token hebt geplakt en of het nog geldig is.",
      );
    }
    console.error("moneybird_connection: listAdministrations failed:", error);
    return createErrorResponse(
      502,
      "Moneybird is op dit moment niet bereikbaar. Probeer het later opnieuw.",
    );
  }

  const choice = chooseAdministration(
    administrations,
    typeof administrationId === "string" ? administrationId.trim() : undefined,
  );
  switch (choice.outcome) {
    case "none":
      return createErrorResponse(
        400,
        "Dit API-token heeft geen toegang tot een Moneybird-administratie.",
      );
    case "not_accessible":
      return createErrorResponse(
        400,
        "Dit API-token heeft geen toegang tot de gekozen administratie.",
      );
    case "ambiguous":
      // Not an error the user did anything wrong about: the frontend shows a
      // picker and retries with an explicit administrationId.
      return createErrorResponse(
        409,
        "Dit token heeft toegang tot meerdere administraties. Kies er een.",
        {
          administrations: choice.administrations.map((administration) => ({
            id: administration.id,
            name: administration.name,
          })),
        },
      );
    case "chosen":
      break;
  }

  const encrypted = await encryptToken(
    trimmedToken,
    encKey,
    connectionAad(salesId),
  );

  const { error } = await supabaseAdmin.from("moneybird_connections").upsert(
    {
      sales_id: salesId,
      administration_id: choice.administration.id,
      administration_name: choice.administration.name,
      api_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sales_id" },
  );
  if (error) {
    console.error(
      `moneybird_connection: could not store the connection for sales ${salesId}:`,
      error.message,
    );
    return createErrorResponse(
      500,
      "De koppeling kon niet worden opgeslagen. Probeer het opnieuw.",
    );
  }

  return jsonResponse({
    data: {
      administrationId: choice.administration.id,
      administrationName: choice.administration.name,
    },
  });
};

const handleDisconnect = async (salesId: number): Promise<Response> => {
  const { error } = await supabaseAdmin
    .from("moneybird_connections")
    .delete()
    .eq("sales_id", salesId);
  if (error) {
    console.error(
      `moneybird_connection: could not delete the connection for sales ${salesId}:`,
      error.message,
    );
    return createErrorResponse(
      500,
      "De koppeling kon niet worden verwijderd. Probeer het opnieuw.",
    );
  }
  return jsonResponse({ data: { disconnected: true } });
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

          if (req.method === "POST") {
            return await handleConnect(req, currentUserSale.id, encKey);
          }
          if (req.method === "DELETE") {
            return await handleDisconnect(currentUserSale.id);
          }
          return createErrorResponse(405, "Method Not Allowed");
        } catch (error) {
          console.error("moneybird_connection failed:", error);
          return createErrorResponse(
            500,
            "Er ging iets mis bij het beheren van de Moneybird-koppeling.",
          );
        }
      }),
    ),
  ),
);
