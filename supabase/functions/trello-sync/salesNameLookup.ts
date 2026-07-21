import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeMemberName } from "./stepSyncLogic.ts";

interface SalesRow {
  id: number;
  first_name: string;
  last_name: string;
}

// Shared name lookup for card owners and checklist assignees. Trello exposes
// full names while the CRM stores first/last name separately, so normalization
// makes matching insensitive to capitalization and repeated whitespace.
export const loadActiveSalesByName = async (): Promise<Map<string, number>> => {
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id, first_name, last_name")
    .neq("disabled", true);
  if (error) {
    throw new Error(`could not load sales users: ${error.message}`);
  }

  const salesByName = new Map<string, number>();
  for (const sale of (data ?? []) as SalesRow[]) {
    salesByName.set(
      normalizeMemberName(`${sale.first_name} ${sale.last_name}`),
      sale.id,
    );
  }
  return salesByName;
};
