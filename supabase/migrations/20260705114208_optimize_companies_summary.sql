-- Optimize companies_summary: replace the double LEFT JOIN + count(distinct) +
-- GROUP BY (which builds a deals x contacts cartesian product per company) with
-- scalar subqueries. Same output columns and values, but no join explosion, and
-- count(*) over the view can skip the subqueries entirely, making the paginated
-- list's exact-count query fast too. Indexes deals_company_id_idx and
-- contacts_company_id_idx already back both subqueries.
create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
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
    (
        select count(*)
        from public.deals d
        where d.company_id = c.id
    ) as nb_deals,
    (
        select count(*)
        from public.contacts co
        where co.company_id = c.id
    ) as nb_contacts
from public.companies c;
