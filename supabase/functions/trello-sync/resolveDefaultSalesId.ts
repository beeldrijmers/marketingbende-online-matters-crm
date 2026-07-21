import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const defaultSalesEmail = Deno.env.get("TRELLO_SYNC_DEFAULT_SALES_EMAIL");
if (!defaultSalesEmail) {
  throw new Error("Missing TRELLO_SYNC_DEFAULT_SALES_EMAIL env variable");
}

let cachedSalesId: number | null = null;

// Use the configured fallback owner only when no Trello member can be matched
// to an active CRM sales user. Existing ownership is never overwritten by the
// fallback, so this only matters when new records are created.
export const resolveDefaultSalesId = async (): Promise<number> => {
  if (cachedSalesId !== null) return cachedSalesId;

  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("email", defaultSalesEmail)
    .neq("disabled", true)
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      `Could not find active sales user for TRELLO_SYNC_DEFAULT_SALES_EMAIL=${defaultSalesEmail}: ${error?.message}`,
    );
  }

  cachedSalesId = data.id;
  return data.id;
};
