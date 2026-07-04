import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Looks up a company by exact name match, creating it when it doesn't exist
// yet. Returns the company id.
export const findOrCreateCompany = async ({
  name,
  salesId,
}: {
  name: string;
  salesId: number;
}): Promise<number> => {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up company "${name}": ${fetchError.message}`,
    );
  }
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabaseAdmin
    .from("companies")
    .insert({ name, sales_id: salesId })
    .select("id")
    .single();
  if (createError || !created) {
    throw new Error(
      `Could not create company "${name}": ${createError?.message}`,
    );
  }
  return created.id;
};
