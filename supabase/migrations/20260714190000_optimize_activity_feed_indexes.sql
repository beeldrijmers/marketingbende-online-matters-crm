-- Keep the activity_log UNION ALL view responsive as the CRM history grows.
-- The dashboard only needs the newest events, while company detail feeds also
-- filter by relationship. Matching indexes support both access patterns.
create index if not exists companies_activity_date_idx
  on public.companies using btree (created_at desc);

create index if not exists contacts_activity_date_idx
  on public.contacts using btree (first_seen desc);

create index if not exists contact_notes_activity_date_idx
  on public.contact_notes using btree (date desc);

create index if not exists deals_activity_date_idx
  on public.deals using btree (created_at desc);

create index if not exists deal_notes_activity_date_idx
  on public.deal_notes using btree (date desc);

create index if not exists contacts_company_activity_idx
  on public.contacts using btree (company_id, first_seen desc);

create index if not exists deals_company_activity_idx
  on public.deals using btree (company_id, created_at desc);

create index if not exists contact_notes_contact_activity_idx
  on public.contact_notes using btree (contact_id, date desc);

create index if not exists deal_notes_deal_activity_idx
  on public.deal_notes using btree (deal_id, date desc);
