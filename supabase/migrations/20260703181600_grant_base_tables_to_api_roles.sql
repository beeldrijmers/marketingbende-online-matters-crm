-- Same gap as 20260601120000_grant_init_state_to_api_roles.sql, but for the
-- base tables instead of the views: their anon/authenticated/service_role
-- grants were never captured in a migration and relied on Supabase's removed
-- legacy behavior of auto-granting every object in the public schema to the
-- API roles. Re-declare them explicitly so a fresh database (local or
-- production) actually exposes these tables through the Data API.
-- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

grant delete on table "public"."companies" to "anon";
grant insert on table "public"."companies" to "anon";
grant select on table "public"."companies" to "anon";
grant update on table "public"."companies" to "anon";

grant delete on table "public"."configuration" to "anon";
grant insert on table "public"."configuration" to "anon";
grant select on table "public"."configuration" to "anon";
grant update on table "public"."configuration" to "anon";
grant delete on table "public"."configuration" to "authenticated";
grant delete on table "public"."configuration" to "service_role";

grant delete on table "public"."contact_notes" to "anon";
grant insert on table "public"."contact_notes" to "anon";
grant select on table "public"."contact_notes" to "anon";
grant update on table "public"."contact_notes" to "anon";

grant delete on table "public"."contacts" to "anon";
grant insert on table "public"."contacts" to "anon";
grant select on table "public"."contacts" to "anon";
grant update on table "public"."contacts" to "anon";

grant delete on table "public"."deal_notes" to "anon";
grant insert on table "public"."deal_notes" to "anon";
grant select on table "public"."deal_notes" to "anon";
grant update on table "public"."deal_notes" to "anon";

grant delete on table "public"."deals" to "anon";
grant insert on table "public"."deals" to "anon";
grant select on table "public"."deals" to "anon";
grant update on table "public"."deals" to "anon";

grant delete on table "public"."favicons_excluded_domains" to "anon";
grant insert on table "public"."favicons_excluded_domains" to "anon";
grant select on table "public"."favicons_excluded_domains" to "anon";
grant update on table "public"."favicons_excluded_domains" to "anon";

grant delete on table "public"."sales" to "anon";
grant insert on table "public"."sales" to "anon";
grant select on table "public"."sales" to "anon";
grant update on table "public"."sales" to "anon";

grant delete on table "public"."tags" to "anon";
grant insert on table "public"."tags" to "anon";
grant select on table "public"."tags" to "anon";
grant update on table "public"."tags" to "anon";

grant delete on table "public"."tasks" to "anon";
grant insert on table "public"."tasks" to "anon";
grant select on table "public"."tasks" to "anon";
grant update on table "public"."tasks" to "anon";
