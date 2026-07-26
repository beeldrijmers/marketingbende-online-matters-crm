-- Een verwijzing naar het item in de wachtwoordkluis, per bedrijf.
--
-- Bewust alleen de link en niet het geheim: inloggegevens horen in de kluis
-- (Bitwarden), niet in deze database. Zo blijft de blast radius van een fout in
-- RLS of van een export beperkt tot "iemand weet dat er een kluisitem is".
alter table public.companies
    add column if not exists vault_url text;

-- De frontend leest bedrijven via deze view, dus de kolom moet er ook in staan.
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
    ) as nb_contacts,
    -- Achteraan, want create or replace view mag kolommen alleen toevoegen aan
    -- het eind; ertussen zetten leest Postgres als het hernoemen van nb_deals.
    c.vault_url
from public.companies c;
