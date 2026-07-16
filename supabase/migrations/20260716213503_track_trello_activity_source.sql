-- `sales_id` is both a CRM ownership/access-control field and, historically,
-- the actor shown in the activity feed. Trello imports use a technical default
-- sales user, which must never be presented as the person who made a Trello
-- update. Keep source attribution alongside every activity-bearing record.
alter table public.companies
  add column activity_source text not null default 'manual',
  add column activity_source_author text,
  add constraint companies_activity_source_check
    check (activity_source in ('manual', 'trello'));

alter table public.contacts
  add column activity_source text not null default 'manual',
  add column activity_source_author text,
  add constraint contacts_activity_source_check
    check (activity_source in ('manual', 'trello'));

alter table public.contact_notes
  add column activity_source text not null default 'manual',
  add column activity_source_author text,
  add constraint contact_notes_activity_source_check
    check (activity_source in ('manual', 'trello'));

alter table public.deals
  add column activity_source text not null default 'manual',
  add column activity_source_author text,
  add constraint deals_activity_source_check
    check (activity_source in ('manual', 'trello'));

alter table public.deal_notes
  add column activity_source text not null default 'manual',
  add column activity_source_author text,
  add constraint deal_notes_activity_source_check
    check (activity_source in ('manual', 'trello'));

-- Trello-linked deals are unambiguous, including cards imported before this
-- column existed. Their creator may not be available historically, so the UI
-- will show "Trello" rather than pretending the technical owner did it.
update public.deals
set activity_source = 'trello'
where trello_card_id is not null;

-- Historical Trello comments already carry the author in the safe transport
-- prefix written by the sync. Promote it to first-class attribution so the
-- activity feed can say "Rick Maarssen heeft ..." instead of "U heeft ...".
with trello_notes as (
  select
    id,
    btrim(substring(text from '(?i)^\[Trello[[:space:]]*-[[:space:]]*([^]]+)\]')) as author
  from public.deal_notes
  where text ~* '^\[Trello[[:space:]]*-[[:space:]]*[^]]+\]'
)
update public.deal_notes as note
set
  activity_source = 'trello',
  activity_source_author = case
    when lower(trello_notes.author) = 'bijlage' then null
    else nullif(trello_notes.author, '')
  end
from trello_notes
where note.id = trello_notes.id;

-- Older company/contact records did not store their import source. Only mark
-- records created alongside a Trello deal (a five-minute window) so manual
-- CRM records are never broadly reclassified.
update public.companies as company
set activity_source = 'trello'
where exists (
  select 1
  from public.deals as deal
  where deal.company_id = company.id
    and deal.activity_source = 'trello'
    and abs(extract(epoch from (deal.created_at - company.created_at))) <= 300
);

update public.contacts as contact
set activity_source = 'trello'
where contact.first_seen is not null
  and exists (
    select 1
    from public.deals as deal
    where deal.company_id = contact.company_id
      and deal.activity_source = 'trello'
      and abs(extract(epoch from (deal.created_at - contact.first_seen))) <= 300
  );
