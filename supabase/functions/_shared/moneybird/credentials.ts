// Per-user Moneybird credential resolution: load the caller's connection row
// and decrypt their personal API token. The encryption key is a parameter (not
// read from the environment here) so this module stays unit-testable in Node;
// supabaseAdmin is mocked in tests via the existing vi.mock pattern.

import { supabaseAdmin } from "../supabaseAdmin.ts";
import { connectionAad, decryptToken } from "./tokenCrypto.ts";

// The per-request credentials every Moneybird API call runs under since the
// integration became per-user.
export interface MoneybirdCredentials {
  apiToken: string;
  administrationId: string;
}

// Resolve the Moneybird credentials for a sales user. Returns null when the
// user has not connected a Moneybird administration (the caller turns that
// into a friendly 4xx). A row that exists but cannot be decrypted is an error,
// not a "not connected": silently treating it as such would let a corrupted
// row or a rotated MONEYBIRD_ENC_KEY masquerade as "please reconnect" without
// anyone noticing the real cause.
export const resolveMoneybirdCredentials = async (
  salesId: number,
  encKey: string,
): Promise<MoneybirdCredentials | null> => {
  const { data, error } = await supabaseAdmin
    .from("moneybird_connections")
    .select("administration_id, api_token_encrypted")
    .eq("sales_id", salesId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not load the Moneybird connection for sales ${salesId}: ${error.message}`,
    );
  }
  if (!data) return null;

  const apiToken = await decryptToken(
    data.api_token_encrypted,
    encKey,
    connectionAad(salesId),
  );
  return { apiToken, administrationId: data.administration_id };
};

// Resolve credentials for a specific ADMINISTRATION rather than a user: any
// connection row bound to that administration will do, since every such token
// can see the administration's documents. Used to reconcile a retried deal
// against the administration a previous (failed) attempt ran in. Returns null
// when nobody is connected to that administration anymore.
export const resolveCredentialsForAdministration = async (
  administrationId: string,
  encKey: string,
): Promise<MoneybirdCredentials | null> => {
  const { data, error } = await supabaseAdmin
    .from("moneybird_connections")
    .select("sales_id, api_token_encrypted")
    .eq("administration_id", administrationId)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not load a Moneybird connection for administration ${administrationId}: ${error.message}`,
    );
  }
  if (!data) return null;

  // The AAD is bound to the OWNER of the row we found, not to the caller.
  const apiToken = await decryptToken(
    data.api_token_encrypted,
    encKey,
    connectionAad(data.sales_id),
  );
  return { apiToken, administrationId };
};
