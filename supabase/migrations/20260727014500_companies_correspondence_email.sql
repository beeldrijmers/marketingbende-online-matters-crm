-- Het adres waar correspondentie over een klant naartoe gaat.
--
-- Een deel van het werk loopt via een partner: Online Matters brengt klanten aan
-- en Terschelling Recreatie loopt via Studio Cupido. Die eindklanten zelf
-- aanschrijven gaat over het hoofd van de partner heen. Staat hier een adres, dan
-- is dat het adres voor een statusupdate, een mail of een agenda-uitnodiging, en
-- waarschuwt de app zodra je toch de klant zelf kiest.
alter table public.companies
    add column if not exists correspondence_email text;

-- De frontend leest bedrijven via deze view. Nieuwe kolommen horen ACHTERAAN,
-- want create or replace view leest een kolom ertussen als een hernoeming.
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
    c.vault_url,
    c.correspondence_email
from public.companies c;
