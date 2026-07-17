-- Keep every entity relation for an imported message/comment, while giving the
-- general activity feed one stable provider event to render.
alter table public.contact_notes add column source_event_id text;
alter table public.deal_notes add column source_event_id text;

-- Repair the duplicate Gmail notification reported on 2026-07-17. Both notes
-- have the exact same immutable content and were inserted immediately after a
-- single claimed Gmail event; retaining both rows preserves both contact
-- timelines, while the shared source id collapses the general feed to one row.
with matching_gmail_event as (
  select email_id
  from public.inbound_email_events
  where email_id like 'gmail:%'
    and processed_at >= '2026-07-17 06:56:50+00'::timestamptz
    and processed_at < '2026-07-17 06:57:10+00'::timestamptz
  order by abs(extract(epoch from (processed_at - '2026-07-17 06:57:01.553716+00'::timestamptz)))
  limit 1
)
update public.contact_notes
set source_event_id = (select email_id from matching_gmail_event)
where id in (162, 163)
  and date >= '2026-07-17 06:57:00+00'::timestamptz
  and date < '2026-07-17 06:57:10+00'::timestamptz
  and md5(coalesce(text, '')) = 'f9b959b979d906681d4b0571c826b3f0'
  and exists (select 1 from matching_gmail_event);

-- The Bouwiva card was renamed with an em dash. The old parser treated the
-- entire project title as a company name and two simultaneous Trello webhooks
-- then inserted it twice. Restore the existing canonical company and remove
-- the now-unreferenced erroneous rows.
do $repair_bouwiva$
declare
  canonical_company_id bigint;
begin
  select id
  into canonical_company_id
  from public.companies
  where lower(btrim(name)) = 'bouwiva'
  order by id
  limit 1;

  if canonical_company_id is null then
    select id
    into canonical_company_id
    from public.companies
    where lower(btrim(name)) = 'bouwiva — website afgerond'
    order by id
    limit 1;

    if canonical_company_id is not null then
      update public.companies
      set name = 'Bouwiva'
      where id = canonical_company_id;
    end if;
  end if;

  if canonical_company_id is not null then
    update public.deals
    set company_id = canonical_company_id
    where trello_card_id = '6a579ebc67948eb7be31b295';

    update public.contacts
    set company_id = canonical_company_id
    where company_id in (
      select id
      from public.companies
      where lower(btrim(name)) = 'bouwiva — website afgerond'
        and id <> canonical_company_id
    );

    delete from public.companies as company
    where lower(btrim(company.name)) = 'bouwiva — website afgerond'
      and company.id <> canonical_company_id
      and not exists (
        select 1 from public.deals where company_id = company.id
      )
      and not exists (
        select 1 from public.contacts where company_id = company.id
      );
  end if;
end
$repair_bouwiva$;

-- Repair any other same-name Trello race defensively before adding the unique
-- index. Manual companies remain outside this merge and outside the index.
create temporary table trello_company_duplicates on commit drop as
select
  id as duplicate_id,
  min(id) over (partition by lower(btrim(name))) as canonical_id
from public.companies
where activity_source = 'trello';

delete from trello_company_duplicates
where duplicate_id = canonical_id;

update public.deals as deal
set company_id = duplicate.canonical_id
from trello_company_duplicates as duplicate
where deal.company_id = duplicate.duplicate_id;

update public.contacts as contact
set company_id = duplicate.canonical_id
from trello_company_duplicates as duplicate
where contact.company_id = duplicate.duplicate_id;

delete from public.companies as company
using trello_company_duplicates as duplicate
where company.id = duplicate.duplicate_id;

create unique index uq__companies__trello_normalized_name
  on public.companies using btree (lower(btrim(name)))
  where activity_source = 'trello';

create unique index uq__contact_notes__source_event_contact
  on public.contact_notes using btree (source_event_id, contact_id)
  where source_event_id is not null;

create unique index uq__deal_notes__source_event_deal
  on public.deal_notes using btree (source_event_id, deal_id)
  where source_event_id is not null;

create or replace view public.activity_log_global with (security_invoker = on) as
select
  id,
  type,
  date,
  company_id,
  sales_id,
  company,
  contact,
  deal,
  contact_note,
  deal_note
from (
  select
    activity.*,
    row_number() over (
      partition by coalesce(
        nullif(activity.contact_note ->> 'source_event_id', ''),
        nullif(activity.deal_note ->> 'source_event_id', ''),
        activity.id
      )
      order by activity.date desc nulls last, activity.id desc
    ) as source_event_rank
  from public.activity_log as activity
) as ranked_activity
where source_event_rank = 1;

grant all on table public.activity_log_global to anon;
grant all on table public.activity_log_global to authenticated;
grant all on table public.activity_log_global to service_role;

-- The idempotency/grouping key and integration attribution are server-owned.
-- Keep ordinary note editing available without allowing clients to forge them.
revoke insert on table public.contact_notes from anon, authenticated;
grant insert (id, contact_id, text, date, sales_id, status, attachments)
  on table public.contact_notes to anon, authenticated;
revoke update on table public.contact_notes from anon, authenticated;
grant update (id, contact_id, text, date, sales_id, status, attachments)
  on table public.contact_notes to anon, authenticated;

revoke insert on table public.deal_notes from anon, authenticated;
grant insert (id, deal_id, type, text, date, sales_id, status, attachments)
  on table public.deal_notes to anon, authenticated;
revoke update on table public.deal_notes from anon, authenticated;
grant update (id, deal_id, type, text, date, sales_id, status, attachments)
  on table public.deal_notes to anon, authenticated;
