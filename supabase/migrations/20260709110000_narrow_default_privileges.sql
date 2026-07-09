-- Secure-by-default for NEW objects in schema public.
--
-- The default privileges granted ALL on every newly-created table, sequence
-- and function to anon + authenticated. That was the root cause of the
-- recurring grant incidents: a sensitive new table (e.g. moneybird_connections
-- with an encrypted API token) was auto-exposed to client roles and had to be
-- manually REVOKE-d afterwards; forgetting that revoke silently exposes data.
--
-- Narrow the default to service_role (+ postgres) only. New objects now start
-- with no client access; anon/authenticated are granted exactly what they need
-- per object in 06_grants.sql. This changes NOTHING for existing objects -
-- default privileges only apply at object-creation time, so every current
-- table/sequence/function keeps the grants it already has.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
