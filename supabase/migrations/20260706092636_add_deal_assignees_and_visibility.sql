drop policy "Enable insert for authenticated users only" on "public"."deal_notes";

drop policy "Enable read access for authenticated users" on "public"."deal_notes";

drop policy "Enable read access for authenticated users" on "public"."deals";

drop policy "Enable update for authenticated users only" on "public"."deals";

drop policy "Enable insert for authenticated users only" on "public"."tasks";

drop policy "Enable read access for authenticated users" on "public"."tasks";

drop policy "Deal Notes Delete Policy" on "public"."deal_notes";

drop policy "Deal Notes Update Policy" on "public"."deal_notes";

drop policy "Deals Delete Policy" on "public"."deals";

drop policy "Task Delete Policy" on "public"."tasks";

drop policy "Task Update Policy" on "public"."tasks";

drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";

alter table "public"."deals" add column "assignee_ids" bigint[] not null default '{}'::bigint[];

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_deal_assignee_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  owner_id bigint;
BEGIN
  -- Every deal must be assigned to at least its owner, otherwise the
  -- assignee-only read policy would make it invisible to everyone (including
  -- its creator). Resolve the owner independently of trigger firing order:
  -- prefer an explicit sales_id, else the caller's own sales row.
  IF NEW.assignee_ids IS NULL OR array_length(NEW.assignee_ids, 1) IS NULL THEN
    owner_id := NEW.sales_id;
    IF owner_id IS NULL THEN
      SELECT id INTO owner_id FROM sales WHERE user_id = auth.uid();
    END IF;
    -- Last resort (e.g. an inbound-mail deal whose forwarder is not a known
    -- sales user): assign the primary admin so a deal is never created
    -- invisible to absolutely everyone.
    IF owner_id IS NULL THEN
      SELECT id INTO owner_id FROM sales WHERE administrator = true ORDER BY id LIMIT 1;
    END IF;
    NEW.assignee_ids := array_remove(ARRAY[owner_id], NULL);
  END IF;
  RETURN NEW;
END;
$function$
;

create or replace view "public"."activity_log" as  SELECT (('company.'::text || c.id) || '.created'::text) AS id,
    'company.created'::text AS type,
    c.created_at AS date,
    c.id AS company_id,
    c.sales_id,
    to_json(c.*) AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.companies c
UNION ALL
 SELECT (('contact.'::text || co.id) || '.created'::text) AS id,
    'contact.created'::text AS type,
    co.first_seen AS date,
    co.company_id,
    co.sales_id,
    NULL::json AS company,
    to_json(co.*) AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.contacts co
UNION ALL
 SELECT (('contactNote.'::text || cn.id) || '.created'::text) AS id,
    'contactNote.created'::text AS type,
    cn.date,
    co.company_id,
    cn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    to_json(cn.*) AS contact_note,
    NULL::json AS deal_note
   FROM (public.contact_notes cn
     LEFT JOIN public.contacts co ON ((co.id = cn.contact_id)))
UNION ALL
 SELECT (('deal.'::text || d.id) || '.created'::text) AS id,
    'deal.created'::text AS type,
    d.created_at AS date,
    d.company_id,
    d.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    to_json(d.*) AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.deals d
UNION ALL
 SELECT (('dealNote.'::text || dn.id) || '.created'::text) AS id,
    'dealNote.created'::text AS type,
    dn.date,
    d.company_id,
    dn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    to_json(dn.*) AS deal_note
   FROM (public.deal_notes dn
     LEFT JOIN public.deals d ON ((d.id = dn.deal_id)));


create or replace view "public"."companies_summary" as  SELECT c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    ( SELECT count(*) AS count
           FROM public.deals d
          WHERE (d.company_id = c.id)) AS nb_deals,
    ( SELECT count(*) AS count
           FROM public.contacts co
          WHERE (co.company_id = c.id)) AS nb_contacts
   FROM public.companies c;


create or replace view "public"."contacts_summary" as  SELECT co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE (t.done_date IS NULL)) AS nb_tasks
   FROM ((public.contacts co
     LEFT JOIN public.tasks t ON ((co.id = t.contact_id)))
     LEFT JOIN public.companies c ON ((co.company_id = c.id)))
  GROUP BY co.id, c.name;



  create policy "Enable insert for deal assignees"
  on "public"."deal_notes"
  as permissive
  for insert
  to authenticated
with check ((deal_id IN ( SELECT deals.id
   FROM public.deals)));



  create policy "Enable read access for deal assignees"
  on "public"."deal_notes"
  as permissive
  for select
  to authenticated
using ((deal_id IN ( SELECT deals.id
   FROM public.deals)));



  create policy "Enable read access for deal assignees"
  on "public"."deals"
  as permissive
  for select
  to authenticated
using ((( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = ( SELECT auth.uid() AS uid))) = ANY (assignee_ids)));



  create policy "Enable update for deal assignees"
  on "public"."deals"
  as permissive
  for update
  to authenticated
using ((( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = ( SELECT auth.uid() AS uid))) = ANY (assignee_ids)))
with check (true);



  create policy "Enable insert for deal assignees"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check (((deal_id IS NULL) OR (deal_id IN ( SELECT deals.id
   FROM public.deals))));



  create policy "Enable read access for deal assignees"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using (((deal_id IS NULL) OR (deal_id IN ( SELECT deals.id
   FROM public.deals))));



  create policy "Deal Notes Delete Policy"
  on "public"."deal_notes"
  as permissive
  for delete
  to authenticated
using ((deal_id IN ( SELECT deals.id
   FROM public.deals)));



  create policy "Deal Notes Update Policy"
  on "public"."deal_notes"
  as permissive
  for update
  to authenticated
using ((deal_id IN ( SELECT deals.id
   FROM public.deals)));



  create policy "Deals Delete Policy"
  on "public"."deals"
  as permissive
  for delete
  to authenticated
using ((( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = ( SELECT auth.uid() AS uid))) = ANY (assignee_ids)));



  create policy "Task Delete Policy"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using (((deal_id IS NULL) OR (deal_id IN ( SELECT deals.id
   FROM public.deals))));



  create policy "Task Update Policy"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using (((deal_id IS NULL) OR (deal_id IN ( SELECT deals.id
   FROM public.deals))));


CREATE TRIGGER set_deal_assignee_default_trigger BEFORE INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_deal_assignee_default();




-- MANUALLY ADDED: restore view grants + security_invoker dropped by the diff.
alter view public.activity_log set (security_invoker = on);
alter view public.companies_summary set (security_invoker = on);
alter view public.contacts_summary set (security_invoker = on);
grant all on table public.activity_log to anon, authenticated, service_role;
grant all on table public.companies_summary to anon, authenticated, service_role;
grant all on table public.contacts_summary to anon, authenticated, service_role;

-- MANUALLY ADDED: allow client roles to write the new column.
revoke update on table public.deals from anon, authenticated;
grant update (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids) on table public.deals to anon, authenticated;
revoke insert on table public.deals from anon, authenticated;
grant insert (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids) on table public.deals to anon, authenticated;

-- DATA MIGRATION: assign every existing deal to its owner. Deals with no owner
-- fall back to the primary admin, so nothing becomes invisible to everyone when
-- the assignee-only read policy takes effect.
update public.deals
set assignee_ids = array[sales_id]
where sales_id is not null
  and (assignee_ids is null or array_length(assignee_ids, 1) is null);

update public.deals
set assignee_ids = array[(select id from public.sales where administrator = true order by id limit 1)]
where sales_id is null
  and (assignee_ids is null or array_length(assignee_ids, 1) is null)
  and exists (select 1 from public.sales where administrator = true);
