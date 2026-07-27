-- Wanneer kwam deze opdracht op zijn huidige stap.
--
-- De factuurrij en de kaarten toonden "wacht al X dagen" op basis van
-- updated_at. Dat veld wordt door de Trello-sync bij elke reactie, elk label en
-- elke bijlage aangeraakt (upsertDealFromCard doet een onvoorwaardelijke UPDATE
-- voor elke actie in CARD_SYNC_ACTIONS), dus een opdracht die maanden stilstaat
-- lijkt vers. Een eigen kolom die alleen op een stapwijziging beweegt zegt wat
-- er bedoeld werd.
alter table public.deals
    add column if not exists stage_since timestamp with time zone not null default now();

-- Beste benadering voor wat er al staat: de laatste aanraking, en anders de
-- aanmaakdatum. Dat is niet exact, maar wel nooit later dan de echte
-- stapwijziging, dus de wachttijd wordt hoogstens onderschat en niet verzonnen.
update public.deals
set stage_since = coalesce(updated_at, created_at)
where stage_since is null or stage_since > coalesce(updated_at, created_at);

create or replace function public.set_deal_stage_since() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if tg_op = 'INSERT' then
    new.stage_since := coalesce(new.stage_since, now());
    return new;
  end if;
  if new.stage is distinct from old.stage then
    new.stage_since := now();
  else
    new.stage_since := coalesce(old.stage_since, new.stage_since, now());
  end if;
  return new;
end;
$$;

create or replace trigger set_deal_stage_since_trigger
    before insert or update on public.deals
    for each row execute function public.set_deal_stage_since();

-- Geen grant nodig, en dat is precies goed. "grant all on table deals" dekt SELECT
-- op elke kolom, ook nieuwe, terwijl UPDATE en INSERT per kolom zijn opgesomd in
-- 06_grants.sql. Deze kolom staat niet in die lijst, dus de frontend kan hem lezen
-- en niet schrijven: alleen de trigger zet hem.
