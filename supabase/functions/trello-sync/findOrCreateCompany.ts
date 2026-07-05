import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Looks up a company by exact name match, creating it when it doesn't exist
// yet. Returns the company id. When a website is provided, it is set on
// creation and back-filled onto an existing company that has none yet (so the
// company_saved trigger can derive the logo/favicon) — but a website already
// present is never overwritten, preserving manual edits.
export const findOrCreateCompany = async ({
  name,
  salesId,
  website,
}: {
  name: string;
  salesId: number;
  website?: string | null;
}): Promise<number> => {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("companies")
    .select("id, website")
    .eq("name", name)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up company "${name}": ${fetchError.message}`,
    );
  }
  if (existing) {
    if (website && !existing.website) {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({ website })
        .eq("id", existing.id);
      if (updateError) {
        throw new Error(
          `Could not back-fill website for company "${name}": ${updateError.message}`,
        );
      }
    }
    return existing.id;
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("companies")
    .insert(
      website
        ? { name, sales_id: salesId, website }
        : { name, sales_id: salesId },
    )
    .select("id")
    .single();
  if (createError || !created) {
    throw new Error(
      `Could not create company "${name}": ${createError?.message}`,
    );
  }
  return created.id;
};
