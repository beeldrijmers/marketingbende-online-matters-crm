-- Stage labels lose their Trello list numbers.
--
-- The board's column names are what people read all day; the numbers were an
-- internal mapping detail that leaked into the interface ("00 · Nog niet
-- bevestigd"). Only the `label` fields change here: every `value` is the
-- contract that billing, reporting and the Trello sync rely on, so those stay
-- exactly as they are.
--
-- Without this the seeded configuration row keeps overriding the labels that
-- ship in src/components/atomic-crm/root/appConfiguration.ts on every login.

update public.configuration
set config = jsonb_set(
  config,
  '{dealStages}',
  $json$[
    {"value":"informatie-pipeline","label":"Nog niet bevestigd"},
    {"value":"bevestigd-inplannen","label":"Inplannen"},
    {"value":"on-hold","label":"Wacht op input"},
    {"value":"bezig","label":"Bezig"},
    {"value":"controle-livegang","label":"Controle en livegang"},
    {"value":"facturatie-live","label":"Te factureren"},
    {"value":"won","label":"Afgerond"},
    {"value":"maandelijks","label":"Vaste klanten"}
  ]$json$::jsonb,
  true
)
where id = 1;
