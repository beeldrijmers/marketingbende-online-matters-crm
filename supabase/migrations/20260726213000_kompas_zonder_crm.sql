-- De naam die gebruikers zien komt niet uit de code maar uit deze rij: de app
-- haalt de configuratie op en die waarde wint van de standaard in
-- appConfiguration.ts. Migratie 20260725210000 zette hem op "Kompas CRM", en het
-- woordmerk draagt sindsdien geen suffix meer, dus de naam is enkel "Kompas".
--
-- Deze rij is in productie al met de hand bijgewerkt; deze migratie zorgt dat een
-- verse database (of een reset) dezelfde naam krijgt in plaats van de oude.
update public.configuration
set config = jsonb_set(config, '{title}', '"Kompas"'::jsonb, true)
where config->>'title' = 'Kompas CRM';
