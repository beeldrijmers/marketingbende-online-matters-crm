-- "Weet de klant het al?" is a question the board could not answer: a deal in
-- "Wacht op input" looks identical whether the client was told yesterday or
-- three weeks ago. This records when a status update was last shared from the
-- CRM; the shared text itself is kept as a deal note, so the wording stays
-- readable in the deal's own history.
alter table public.deals
    add column if not exists client_updated_at timestamp with time zone;

-- deals uses column-level INSERT/UPDATE grants (the moneybird_* bookkeeping
-- columns must stay service-role only), so a new client-writable column needs
-- its privilege granted explicitly. Without this the column exists but the
-- frontend silently cannot write it.
grant update (client_updated_at) on table public.deals to anon, authenticated;
grant insert (client_updated_at) on table public.deals to anon, authenticated;
