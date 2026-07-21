-- Align the CRM kanban with the numbered Trello production line while keeping
-- existing internal stage values used by billing and revenue reporting.

-- The old CRM had no explicit monthly-client column and therefore recycled a
-- completed recurring deal automatically. Trello now uses permanent client
-- cards plus a separate card per month, so that trigger would reopen completed
-- month cards and duplicate revenue.
drop trigger if exists cycle_monthly_deal_trigger on public.deals;
drop function if exists public.cycle_monthly_deal();

alter table public.deals drop constraint if exists deals_stage_check;

alter table public.deals
  add constraint deals_stage_check check (
    stage in (
      'informatie-pipeline',
      'bevestigd-inplannen',
      'on-hold',
      'bezig',
      'controle-livegang',
      'facturatie-live',
      'won',
      'maandelijks',
      'lost'
    )
  ) not valid;

-- The UI and Trello sync already supply an explicit deadline. This database
-- default covers other ingestion paths (for example an inbound e-mail), and
-- the data update repairs only active records that still lack any date.
alter table public.deals
  alter column expected_closing_date set default (
    date_trunc('month', now() at time zone 'Europe/Amsterdam')
    + interval '1 month - 1 day'
  )::date;

update public.deals
set expected_closing_date = (
  date_trunc('month', now() at time zone 'Europe/Amsterdam')
  + interval '1 month - 1 day'
)::date
where expected_closing_date is null
  and archived_at is null
  and stage not in ('won', 'lost');

create or replace function public.ensure_deal_next_action(target_deal_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deal_record record;
  action_text text;
  action_due timestamptz;
begin
  select id, stage, archived_at, expected_closing_date, sales_id
  into deal_record
  from public.deals
  where id = target_deal_id;

  if not found then
    return;
  end if;

  if deal_record.archived_at is not null
     or deal_record.stage in ('won', 'lost', 'on-hold') then
    delete from public.tasks
    where deal_id = target_deal_id
      and source = 'auto'
      and done_date is null;
    return;
  end if;

  if exists (
    select 1
    from public.tasks
    where deal_id = target_deal_id
      and done_date is null
      and source <> 'auto'
  ) then
    delete from public.tasks
    where deal_id = target_deal_id
      and source = 'auto'
      and done_date is null;
    return;
  end if;

  action_text := case deal_record.stage
    when 'informatie-pipeline' then 'Neem contact op en bevestig de opdracht'
    when 'bevestigd-inplannen' then 'Plan het werk en leg de eerstvolgende actie vast'
    when 'bezig' then 'Werk de volgende dealstap af'
    when 'controle-livegang' then 'Controleer het werk en vraag akkoord voor livegang'
    when 'facturatie-live' then 'Controleer de gegevens en verstuur de Moneybird-factuur'
    when 'maandelijks' then 'Plan en voer de volgende maandactie uit'
    else 'Plan de volgende stap voor deze deal'
  end;

  action_due := case
    when deal_record.expected_closing_date is not null
         and deal_record.expected_closing_date >= current_date
      then deal_record.expected_closing_date::timestamptz + interval '9 hours'
    when deal_record.stage in (
      'informatie-pipeline',
      'bevestigd-inplannen',
      'controle-livegang',
      'facturatie-live'
    ) then now() + interval '1 day'
    else now() + interval '3 days'
  end;

  update public.tasks
  set text = action_text,
      due_date = action_due,
      sales_id = deal_record.sales_id
  where deal_id = target_deal_id
    and source = 'auto'
    and done_date is null;

  if found then
    return;
  end if;

  insert into public.tasks (
    deal_id,
    type,
    text,
    due_date,
    sales_id,
    source
  ) values (
    target_deal_id,
    'none',
    action_text,
    action_due,
    deal_record.sales_id,
    'auto'
  );
end;
$$;

create or replace function public.set_task_due_date_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deal_record record;
begin
  if new.due_date is not null then
    return new;
  end if;

  if new.deal_id is not null then
    select stage, expected_closing_date
    into deal_record
    from public.deals
    where id = new.deal_id;

    new.due_date := case
      when deal_record.expected_closing_date is not null
           and deal_record.expected_closing_date >= current_date
        then deal_record.expected_closing_date::timestamptz + interval '9 hours'
      when deal_record.stage in (
        'informatie-pipeline',
        'bevestigd-inplannen',
        'controle-livegang',
        'facturatie-live'
      ) then now() + interval '1 day'
      else now() + interval '3 days'
    end;
  else
    new.due_date := now() + interval '3 days';
  end if;

  return new;
end;
$$;

-- Production may contain an administrator-edited configuration document. Set
-- only the workflow keys and preserve branding, categories and all other
-- custom settings.
insert into public.configuration (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

update public.configuration
set config = jsonb_set(
  jsonb_set(
    config,
    '{dealStages}',
    $json$[
      {"value":"informatie-pipeline","label":"00 · Nog niet bevestigd"},
      {"value":"bevestigd-inplannen","label":"10 · Bevestigd / inplannen"},
      {"value":"on-hold","label":"20 · Wacht op input / geblokkeerd"},
      {"value":"bezig","label":"30 · Bezig"},
      {"value":"controle-livegang","label":"40 · Controle / akkoord / livegang"},
      {"value":"facturatie-live","label":"50 · Klaar / te factureren"},
      {"value":"won","label":"60 · Gefactureerd / afgerond"},
      {"value":"maandelijks","label":"70 · Maandelijks / vaste klanten"}
    ]$json$::jsonb,
    true
  ),
  '{dealPipelineStatuses}',
  '["won"]'::jsonb,
  true
)
where id = 1;
