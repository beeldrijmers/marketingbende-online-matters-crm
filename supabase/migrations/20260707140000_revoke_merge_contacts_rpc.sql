-- The legacy merge_contacts(bigint, bigint) SQL RPC runs under the caller's
-- RLS (no SECURITY DEFINER), the same flaw the merge_contacts edge function
-- had: with deals/tasks now assignee-restricted, a merge would skip rows on
-- invisible deals and the contact delete's ON DELETE CASCADE would then
-- destroy orphaned tasks. The frontend uses the edge function (which now runs
-- with full privileges); this RPC is an unused alternate path, so revoke it
-- from client roles. service_role keeps it.
revoke all on function public.merge_contacts(bigint, bigint) from anon, authenticated;
