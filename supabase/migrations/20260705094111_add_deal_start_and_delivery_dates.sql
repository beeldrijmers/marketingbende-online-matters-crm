-- Add structured project dates to deals: aanvang (start_date) and oplevering
-- (delivery_date). Extracted automatically from inbound email by the
-- resend_inbound edge function, and editable in the CRM.
alter table public.deals add column if not exists start_date date;
alter table public.deals add column if not exists delivery_date date;
