drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";

set check_function_bodies = off;

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


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sales_count int;
  derived_partij text;
begin
  select count(id) into sales_count
  from public.sales;

  -- Assign the collaborating party from the sign-up email domain, so a new
  -- Online Matters account gets its own colour instead of the default.
  derived_partij := case
    when new.email like '%@onlinematters.nl' then 'online_matters'
    when new.email like '%@marketingbende.nl' then 'marketingbende'
    else 'marketingbende'
  end;

  insert into public.sales (first_name, last_name, email, user_id, administrator, partij)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end,
    derived_partij
  );
  return new;
end;
$function$
;




-- MANUALLY ADDED: restore view grants + security_invoker dropped by the diff.
alter view public.activity_log set (security_invoker = on);
alter view public.companies_summary set (security_invoker = on);
alter view public.contacts_summary set (security_invoker = on);
grant all on table public.activity_log to anon, authenticated, service_role;
grant all on table public.companies_summary to anon, authenticated, service_role;
grant all on table public.contacts_summary to anon, authenticated, service_role;

-- BACKFILL: align existing users' party with their email domain (idempotent).
update public.sales
set partij = case
  when email like '%@onlinematters.nl' then 'online_matters'
  when email like '%@marketingbende.nl' then 'marketingbende'
  else partij
end
where partij is distinct from (case
  when email like '%@onlinematters.nl' then 'online_matters'
  when email like '%@marketingbende.nl' then 'marketingbende'
  else partij
end);
