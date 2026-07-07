-- Idempotency ledger for the Resend inbound-email webhook. Resend/Svix deliver
-- at-least-once, so a redelivered or retried event must not re-process the
-- same mail (which would create duplicate contact/deal notes). The webhook
-- claims an email_id here before processing; a conflicting insert means
-- "already handled". Only the edge function (service_role) touches it.
create table if not exists public.inbound_email_events (
    email_id text primary key,
    processed_at timestamp with time zone not null default now()
);

-- No client policies: RLS-on + no-policy means anon/authenticated can neither
-- read nor write it; service_role (the webhook) bypasses RLS.
alter table public.inbound_email_events enable row level security;
