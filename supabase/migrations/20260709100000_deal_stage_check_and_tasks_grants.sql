-- Two low-risk hardening items from the CRM audit.

-- 1. deals.stage may only hold a known pipeline value. Triggers and the
--    revenue/kanban logic key off these exact strings, so a stray value (e.g.
--    a bad import) would make a card silently vanish from the board. The set
--    is the five kanban stages plus 'lost' (used by the revenue model /
--    DealsPipeline filter, though not a kanban column). NOT VALID: the check
--    is enforced on every future insert/update but does not scan (and possibly
--    reject) pre-existing rows, so it can never fail this migration.
alter table public.deals
  add constraint deals_stage_check
  check (stage in ('informatie-pipeline', 'bezig', 'on-hold', 'facturatie-live', 'won', 'lost'))
  not valid;

-- 2. tasks.source and tasks.trello_checkitem_id are the Trello-sync idempotency
--    keys, written exclusively by the trello-sync edge function (service role,
--    which bypasses column grants). Client roles must not be able to forge or
--    reset them, mirroring the moneybird-column protection on deals. A
--    table-wide grant beats a column-level revoke, so the table-wide
--    insert/update is revoked and re-granted for the user-managed columns only.
revoke insert on table public.tasks from anon, authenticated;
grant insert (id, contact_id, deal_id, type, text, due_date, done_date, sales_id)
  on table public.tasks to anon, authenticated;
revoke update on table public.tasks from anon, authenticated;
grant update (id, contact_id, deal_id, type, text, due_date, done_date, sales_id)
  on table public.tasks to anon, authenticated;
