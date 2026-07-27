-- "Laatste activiteit" was een aanname.
--
-- Vijf schermen sorteren opdrachten op updated_at, maar niets werkte dat veld
-- bij: er stond geen trigger op en geen enkele schrijver zette het mee. Van de
-- drieënveertig lopende opdrachten stond de laatste wijziging op 24 juli,
-- terwijl er die dagen volop is gewerkt. Wat je op het bord zag was dus feitelijk
-- de aanmaakvolgorde.
--
-- De vergelijking staat hier en niet in de synchronisatie, omdat de Trello-sync
-- per kaart een onvoorwaardelijke UPDATE doet, ook als er niets veranderd is. Een
-- kale now()-trigger zou bij elke ronde alle opdrachten vers maken; dat is net zo
-- onwaar als een veld dat stilstaat. Door de rij met zichzelf te vergelijken telt
-- alleen een echte wijziging, ongeacht wie hem doet.
create or replace function public.touch_deal_updated_at() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if new is distinct from old then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- De naam moet alfabetisch na set_* en sync_* komen: Postgres vuurt triggers van
-- dezelfde soort in die volgorde af, en deze hoort te kijken naar de rij zoals de
-- andere triggers hem hebben achtergelaten (assignee, stage_since, on_hold).
create or replace trigger touch_deal_updated_at_trigger
    before update on public.deals
    for each row execute function public.touch_deal_updated_at();
