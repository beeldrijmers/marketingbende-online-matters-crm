import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const normalizedCompanyName = (name: string): string =>
  name.trim().toLowerCase();

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
  sourceAuthor,
  website,
  lookupWebsite,
}: {
  name: string;
  salesId: number;
  sourceAuthor?: string | null;
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
  const trimmedSourceAuthor = sourceAuthor?.trim();
  const { data: created, error: createError } = await supabaseAdmin
    .from("companies")
    .insert(
      resolved
        ? {
            name,
            sales_id: salesId,
            website: resolved,
            activity_source: "trello",
            ...(trimmedSourceAuthor
              ? { activity_source_author: trimmedSourceAuthor }
              : {}),
          }
        : {
            name,
            sales_id: salesId,
            activity_source: "trello",
            ...(trimmedSourceAuthor
              ? { activity_source_author: trimmedSourceAuthor }
              : {}),
          },
    )
    .select("id")
    .single();
  // Two Trello actions for one card can arrive concurrently. Both may have
  // observed "not found" above; the partial unique index lets one insert win.
  // Treat the loser's 23505 as a successful idempotent lookup instead of
  // failing the webhook (which would only cause another retry).
  if (createError?.code === "23505") {
    // The index also normalizes case/outer whitespace. Fetch imported names on
    // this rare conflict path and apply the same normalization client-side, so
    // "Bouwiva" and " bouwiva " resolve to the same winner.
    const { data: importedCompanies, error: refetchError } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("activity_source", "trello")
      .order("id", { ascending: true });
    const concurrentlyCreated = importedCompanies?.find(
      (company) =>
        normalizedCompanyName(company.name as string) ===
        normalizedCompanyName(name),
    );
    if (refetchError || !concurrentlyCreated) {
      throw new Error(
        `Company "${name}" was created concurrently but could not be re-fetched: ${refetchError?.message ?? "not found"}`,
      );
    }
    return concurrentlyCreated.id;
  }
  if (createError || !created) {
    throw new Error(
      `Could not create company "${name}": ${createError?.message}`,
    );
  }
  return created.id;
};
