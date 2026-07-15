// Per-user Gmail OAuth connection management.
//
// POST (authenticated) creates a one-use OAuth state and returns Google's
// authorization URL. Google redirects to /callback, where the code is
// exchanged server-side and the refresh token is encrypted before storage.
// DELETE (authenticated) revokes and removes the caller's own connection.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getGmailProfile } from "../_shared/gmail/client.ts";
import {
  decryptGmailToken,
  encryptGmailToken,
  gmailConnectionAad,
} from "../_shared/gmail/tokenCrypto.ts";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const oauthRedirectUri = (): string =>
  Deno.env.get("GMAIL_OAUTH_REDIRECT_URI") ??
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-connection/callback`;

const appReturnUrl = (result: "connected" | "error"): string => {
  const base =
    Deno.env.get("GMAIL_OAUTH_RETURN_URL") ??
    "https://crm.marketingbende.nl/#/settings";
  return `${base}${base.includes("?") ? "&" : "?"}gmail=${result}`;
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const randomState = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const buildGmailAuthorizationUrl = ({
  clientId,
  redirectUri,
  state,
  loginHint,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params}`;
};

const handleAuthorize = async (
  salesId: number,
  salesEmail: string,
): Promise<Response> => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) {
    return createErrorResponse(
      503,
      "De Gmail-koppeling is nog niet geconfigureerd op de server.",
    );
  }

  const state = randomState();
  // Abandoned consent screens leave harmless state rows behind. Clean them up
  // opportunistically so the server-only table remains bounded.
  await supabaseAdmin
    .from("gmail_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin.from("gmail_oauth_states").insert({
    state_hash: await sha256(state),
    sales_id: salesId,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) {
    console.error("Could not create Gmail OAuth state:", error.message);
    return createErrorResponse(500, "Gmail koppelen kon niet worden gestart.");
  }

  return jsonResponse({
    data: {
      authorizationUrl: buildGmailAuthorizationUrl({
        clientId,
        redirectUri: oauthRedirectUri(),
        state,
        loginHint: salesEmail,
      }),
    },
  });
};

const handleCallback = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || url.searchParams.get("error")) {
    return Response.redirect(appReturnUrl("error"), 302);
  }

  // Delete-and-return makes the random state atomic and one-use.
  const { data: oauthState, error: stateError } = await supabaseAdmin
    .from("gmail_oauth_states")
    .delete()
    .eq("state_hash", await sha256(state))
    .gt("expires_at", new Date().toISOString())
    .select("sales_id")
    .maybeSingle();
  if (stateError || !oauthState) {
    console.error("Invalid or expired Gmail OAuth state");
    return Response.redirect(appReturnUrl("error"), 302);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const encKey = Deno.env.get("GMAIL_ENC_KEY");
  if (!clientId || !clientSecret || !encKey) {
    console.error("Gmail OAuth server secrets are incomplete");
    return Response.redirect(appReturnUrl("error"), 302);
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    console.error(`Gmail OAuth exchange failed with ${tokenResponse.status}`);
    return Response.redirect(appReturnUrl("error"), 302);
  }
  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokens.access_token || !tokens.refresh_token) {
    console.error("Gmail OAuth response did not include offline access");
    return Response.redirect(appReturnUrl("error"), 302);
  }

  try {
    const profile = await getGmailProfile(tokens.access_token);
    const encrypted = await encryptGmailToken(
      tokens.refresh_token,
      encKey,
      gmailConnectionAad(oauthState.sales_id),
    );
    const { error } = await supabaseAdmin.from("gmail_connections").upsert(
      {
        sales_id: oauthState.sales_id,
        email: profile.emailAddress.toLowerCase(),
        refresh_token_encrypted: encrypted,
        // A reconnect starts with a bounded full import and a fresh boundary.
        history_id: null,
        sync_status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sales_id" },
    );
    if (error) throw new Error(error.message);
    return Response.redirect(appReturnUrl("connected"), 302);
  } catch (error) {
    console.error("Could not store Gmail connection:", error);
    return Response.redirect(appReturnUrl("error"), 302);
  }
};

const handleDisconnect = async (salesId: number): Promise<Response> => {
  // Google token revocation is best-effort because a Google outage must not
  // prevent a user from deleting the local encrypted connection.
  const { data: connection } = await supabaseAdmin
    .from("gmail_connections")
    .select("refresh_token_encrypted")
    .eq("sales_id", salesId)
    .maybeSingle();
  const encKey = Deno.env.get("GMAIL_ENC_KEY");
  if (connection?.refresh_token_encrypted && encKey) {
    try {
      const refreshToken = await decryptGmailToken(
        connection.refresh_token_encrypted,
        encKey,
        gmailConnectionAad(salesId),
      );
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch (error) {
      console.error("Gmail token revocation failed; deleting locally:", error);
    }
  }

  const { error } = await supabaseAdmin
    .from("gmail_connections")
    .delete()
    .eq("sales_id", salesId);
  if (error) {
    console.error("Could not disconnect Gmail:", error.message);
    return createErrorResponse(500, "Gmail kon niet worden losgekoppeld.");
  }
  return jsonResponse({ data: { disconnected: true } });
};

Deno.serve(async (req) => {
  if (
    req.method === "GET" &&
    new URL(req.url).pathname.endsWith("/gmail-connection/callback")
  ) {
    return handleCallback(req);
  }

  return OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const sale = await getUserSale(user!);
        if (!sale) return createErrorResponse(401, "Unauthorized");
        if (req.method === "POST") {
          return handleAuthorize(sale.id, sale.email);
        }
        if (req.method === "DELETE") return handleDisconnect(sale.id);
        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  );
});
