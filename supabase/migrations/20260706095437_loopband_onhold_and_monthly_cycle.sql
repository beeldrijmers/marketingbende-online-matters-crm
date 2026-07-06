drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";

alter table "public"."deals" add column "on_hold" boolean not null default false;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cycle_monthly_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- A monthly recurring deal that reaches "Klaar" is not finished - the work
  -- recurs next month. Instead of letting it rest in the won stage, send it
  -- back to the start of the loopband, un-tick its Trello-synced steps and
  -- record the restart. Fires only on the actual transition into "won", so it
  -- runs once per completion (not on every save while already there).
  IF NEW.revenue_period = 'maandelijks'
     AND NEW.stage = 'won'
     AND OLD.stage IS DISTINCT FROM 'won' THEN
    NEW.stage := 'informatie-pipeline';

    UPDATE public.tasks
      SET done_date = NULL
      WHERE deal_id = NEW.id AND source = 'trello' AND done_date IS NOT NULL;

    INSERT INTO public.deal_notes (deal_id, text, sales_id, date)
      VALUES (
        NEW.id,
        'Maandelijkse cyclus opnieuw gestart op ' || to_char(now(), 'DD-MM-YYYY') || '.',
        NEW.sales_id,
        now()
      );
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


CREATE TRIGGER cycle_monthly_deal_trigger BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.cycle_monthly_deal();




-- MANUALLY ADDED: restore view grants + security_invoker dropped by the diff.
alter view public.activity_log set (security_invoker = on);
alter view public.companies_summary set (security_invoker = on);
alter view public.contacts_summary set (security_invoker = on);
grant all on table public.activity_log to anon, authenticated, service_role;
grant all on table public.companies_summary to anon, authenticated, service_role;
grant all on table public.contacts_summary to anon, authenticated, service_role;

-- MANUALLY ADDED: allow client roles to write the new on_hold column.
revoke update on table public.deals from anon, authenticated;
grant update (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold) on table public.deals to anon, authenticated;
revoke insert on table public.deals from anon, authenticated;
grant insert (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold) on table public.deals to anon, authenticated;

-- DATA MIGRATION: "on hold" is no longer a stage. Move any deal that still sits
-- in the old on-hold stage into "bezig" and flag it on_hold, so it stays on the
-- loopband with a badge instead of disappearing with the removed column.
update public.deals
set on_hold = true, stage = 'bezig'
where stage = 'on-hold';
