import { supabaseAdmin } from "../supabaseAdmin.ts";
import { refreshGmailAccessToken } from "./client.ts";
import { decryptGmailToken, gmailConnectionAad } from "./tokenCrypto.ts";

/**
 * A fresh Google access token for one CRM user, from their stored refresh token.
 *
 * One Google connection per user serves both Gmail and Calendar, so this lives
 * next to the token instead of inside the Gmail connection function: the
 * calendar function needs exactly the same three steps (find the connection,
 * decrypt, refresh) and duplicating them would let the two drift apart.
 */
export class GoogleConnectionMissing extends Error {}

export const getGoogleAccessToken = async (
  salesId: number,
): Promise<string> => {
  const { data: connection, error } = await supabaseAdmin
    .from("gmail_connections")
    .select("refresh_token_encrypted")
    .eq("sales_id", salesId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection?.refresh_token_encrypted) {
    throw new GoogleConnectionMissing("Google connection not found");
  }

  const encKey = Deno.env.get("GMAIL_ENC_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!encKey || !clientId || !clientSecret) {
    throw new Error("Google integration secrets are not configured");
  }

  const refreshToken = await decryptGmailToken(
    connection.refresh_token_encrypted,
    encKey,
    gmailConnectionAad(salesId),
  );
  return refreshGmailAccessToken({ refreshToken, clientId, clientSecret });
};
