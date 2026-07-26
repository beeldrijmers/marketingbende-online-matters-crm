-- A task with a start time is an appointment in the owner's Google Calendar.
--
-- "Rick belt de klant donderdag om tien uur" is one thing, not two: the CRM
-- should not keep a shadow copy of a moment that also has to exist in a
-- calendar. So a task grows a start and an end, plus the identity of the Google
-- event it became.
--
-- These columns are written by the calendar edge function only. The browser asks
-- for an appointment; Google decides what it became (id, link, actual times) and
-- the function stores that answer — the same split the moneybird_* columns on
-- deals use, and for the same reason: a client role must not be able to forge a
-- link to an event that does not exist.
alter table public.tasks
    add column if not exists starts_at timestamp with time zone,
    add column if not exists ends_at timestamp with time zone,
    add column if not exists calendar_event_id text,
    add column if not exists calendar_html_link text,
    add column if not exists calendar_synced_at timestamp with time zone;

alter table public.tasks
    drop constraint if exists tasks_appointment_range_check;
alter table public.tasks
    add constraint tasks_appointment_range_check
    check (starts_at is null or ends_at is null or starts_at < ends_at);

create unique index if not exists uq__tasks__calendar_event_id
    on public.tasks using btree (calendar_event_id)
    where (calendar_event_id is not null);
create index if not exists tasks_appointment_start_idx
    on public.tasks using btree (starts_at)
    where (starts_at is not null);

-- tasks already uses column-level INSERT/UPDATE grants. The new columns are
-- deliberately left out of them: service_role keeps them, client roles read them.
-- Re-granting the existing list explicitly documents that choice rather than
-- leaving it to whoever reads the migration next.
revoke insert on table public.tasks from anon, authenticated;
grant insert (id, contact_id, deal_id, type, text, due_date, done_date, sales_id)
    on table public.tasks to anon, authenticated;
revoke update on table public.tasks from anon, authenticated;
grant update (id, contact_id, deal_id, type, text, due_date, done_date, sales_id)
    on table public.tasks to anon, authenticated;
