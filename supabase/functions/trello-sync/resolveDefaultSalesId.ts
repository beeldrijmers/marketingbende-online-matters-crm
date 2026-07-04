import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const defaultSalesEmail = Deno.env.get("TRELLO_SYNC_DEFAULT_SALES_EMAIL");
if (!defaultSalesEmail) {
  throw new Error("Missing TRELLO_SYNC_DEFAULT_SALES_EMAIL env variable");
}

let cachedSalesId: number | null = null;

// Trello card members aren't reliably mappable to CRM sales users (e.g. Rick
// Maarssen has no CRM account yet), so newly-synced deals/companies are
// attributed to a single configured default sales user instead. Existing
// records are never overwritten, so this only matters at creation time.
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
