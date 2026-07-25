-- Support the foreign-key lookup/cascade path without scanning the short-lived
-- OAuth state table.
create index if not exists gmail_oauth_states_sales_id_idx
    on public.gmail_oauth_states using btree (sales_id);

-- This privileged helper only reads a fully qualified auth table. An empty
-- search path prevents caller-controlled object shadowing.
alter function public.get_user_id_by_email(text)
    set search_path to '';
