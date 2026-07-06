-- The auto-generated migrations 20260705214619 and 20260706024953 recreated the
-- summary views with DROP VIEW + CREATE VIEW, which silently dropped both the
-- API-role grants and the security_invoker option (the db diff tool never emits
-- those). On production this returned 403 for every companies_summary /
-- contacts_summary request and made the views bypass RLS. Restore the state
-- declared in schemas/03_views.sql and schemas/06_grants.sql.
grant all on table public.activity_log to anon, authenticated, service_role;
grant all on table public.companies_summary to anon, authenticated, service_role;
grant all on table public.contacts_summary to anon, authenticated, service_role;

alter view public.activity_log set (security_invoker = on);
alter view public.companies_summary set (security_invoker = on);
alter view public.contacts_summary set (security_invoker = on);

-- Production's default privileges for the postgres role had lost the API-role
-- entries, so recreated objects end up without usable grants. Re-assert the
-- defaults from schemas/06_grants.sql so the next DROP+CREATE migration cannot
-- break API access again.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
