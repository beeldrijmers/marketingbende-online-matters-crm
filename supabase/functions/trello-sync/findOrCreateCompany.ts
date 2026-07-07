import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Looks up a company by exact name match, creating it when it doesn't exist
// yet. Returns the company id.
//
// Website resolution (for the logo/favicon, derived by the company_saved
// trigger): the `website` argument (taken from the Trello card) wins; when it is
// absent and the company has none yet, the optional `lookupWebsite` fallback is
// consulted (a best-effort name->domain web lookup). A website already present
// is never overwritten, preserving manual edits, and the lookup runs at most
// once per company that actually needs one.
export const findOrCreateCompany = async ({
  name,
  salesId,
  website,
  lookupWebsite,
}: {
  name: string;
  salesId: number;
  website?: string | null;
  lookupWebsite?: () => Promise<string | null>;
}): Promise<number> => {
  // companies.name has no unique constraint (a user can manually create a
  // company with a name the sync also knows), so pick the oldest match
  // deterministically instead of letting .maybeSingle() fail on duplicates —
  // one duplicate name must not permanently break the sync for that company.
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("companies")
    .select("id, website")
    .eq("name", name)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchError) {
    throw new Error(
      `Could not look up company "${name}": ${fetchError.message}`,
    );
  }

  const resolveWebsite = async (): Promise<string | null> =>
    website ?? (lookupWebsite ? await lookupWebsite() : null);

  if (existing) {
    if (!existing.website) {
      const resolved = await resolveWebsite();
      if (resolved) {
        const { error: updateError } = await supabaseAdmin
          .from("companies")
          .update({ website: resolved })
          .eq("id", existing.id);
        if (updateError) {
          throw new Error(
            `Could not back-fill website for company "${name}": ${updateError.message}`,
          );
        }
      }
    }
    return existing.id;
  }

  const resolved = await resolveWebsite();
  const { data: created, error: createError } = await supabaseAdmin
    .from("companies")
    .insert(
      resolved
        ? { name, sales_id: salesId, website: resolved }
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
