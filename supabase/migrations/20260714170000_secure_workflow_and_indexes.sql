-- Invite-only hardening, active-user RLS, dated automatic next actions and
-- indexes for the dashboard/sync access paths.

alter view public.init_state set (security_invoker = true);

alter table public.tasks drop constraint tasks_source_check;
alter table public.tasks
  add constraint tasks_source_check check (source in ('manual', 'trello', 'auto'));

create index companies_sales_id_idx on public.companies using btree (sales_id);
create index contacts_sales_id_idx on public.contacts using btree (sales_id);
create index contact_notes_sales_id_idx on public.contact_notes using btree (sales_id);
create index deal_notes_sales_id_idx on public.deal_notes using btree (sales_id);
create index deals_sales_id_idx on public.deals using btree (sales_id);
create index deals_moneybird_estimate_created_by_idx on public.deals using btree (moneybird_estimate_created_by);
create index deals_moneybird_invoice_created_by_idx on public.deals using btree (moneybird_invoice_created_by);
create index contacts_email_jsonb_idx on public.contacts using gin (email_jsonb);
create index deals_active_stage_closing_idx on public.deals using btree (stage, expected_closing_date) where (archived_at is null);
create index tasks_open_due_date_idx on public.tasks using btree (due_date) where (done_date is null);

create or replace function public.is_active_crm_user() returns boolean
  language sql stable security definer
  set search_path to ''
as $$
  select exists (
    select 1
    from public.sales
    where user_id = auth.uid()
      and disabled = false
  );
$$;

create or replace function public.is_admin() returns boolean
  language plpgsql security definer
  set search_path to ''
as $$
begin
  return exists (
    select 1
    from public.sales
    where user_id = auth.uid()
      and administrator = true
      and disabled = false
  );
end;
$$;

create or replace function public.ensure_deal_next_action(target_deal_id bigint) returns void
  language plpgsql security definer
  set search_path to ''
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

  if exists (
    select 1
    from public.tasks
    where deal_id = target_deal_id
      and done_date is null
      and source = 'auto'
  ) then
    return;
  end if;

  action_text := case deal_record.stage
    when 'informatie-pipeline' then 'Kwalificeer de deal en plan het vervolggesprek'
    when 'bezig' then 'Werk de volgende dealstap af'
    when 'facturatie-live' then 'Controleer de gegevens en maak de Moneybird-factuur'
    else 'Plan de volgende stap voor deze deal'
  end;

  action_due := case
    when deal_record.expected_closing_date is not null
         and deal_record.expected_closing_date >= current_date
      then deal_record.expected_closing_date::timestamptz + interval '9 hours'
    when deal_record.stage in ('facturatie-live', 'informatie-pipeline')
      then now() + interval '1 day'
    else now() + interval '3 days'
  end;

  insert into public.tasks (deal_id, type, text, due_date, sales_id, source)
  values (
    target_deal_id,
    'none',
    action_text,
    action_due,
    deal_record.sales_id,
    'auto'
  );
end;
$$;

create or replace function public.handle_deal_next_action() returns trigger
  language plpgsql security definer
  set search_path to ''
as $$
begin
  perform public.ensure_deal_next_action(new.id);
  return new;
end;
$$;

create or replace function public.set_task_due_date_default() returns trigger
  language plpgsql security definer
  set search_path to ''
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
      when deal_record.stage in ('facturatie-live', 'informatie-pipeline')
        then now() + interval '1 day'
      else now() + interval '3 days'
    end;
  else
    new.due_date := now() + interval '3 days';
  end if;

  return new;
end;
$$;

create or replace function public.handle_task_next_action() returns trigger
  language plpgsql security definer
  set search_path to ''
as $$
declare
  current_deal_id bigint;
  previous_deal_id bigint;
begin
  current_deal_id := case when tg_op = 'DELETE' then old.deal_id else new.deal_id end;
  previous_deal_id := case when tg_op = 'UPDATE' then old.deal_id else null end;

  if current_deal_id is not null then
    perform public.ensure_deal_next_action(current_deal_id);
  end if;

  if previous_deal_id is not null and previous_deal_id is distinct from current_deal_id then
    perform public.ensure_deal_next_action(previous_deal_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace trigger ensure_deal_next_action_trigger
  after insert or update of stage, expected_closing_date, archived_at, sales_id on public.deals
  for each row execute function public.handle_deal_next_action();

create or replace trigger set_task_due_date_default_trigger
  before insert or update of deal_id, due_date on public.tasks
  for each row execute function public.set_task_due_date_default();

create or replace trigger ensure_next_action_after_task_change_trigger
  after insert or update of deal_id, done_date or delete on public.tasks
  for each row execute function public.handle_task_next_action();

drop policy "Enable read access for authenticated users" on public.companies;
drop policy "Enable insert for authenticated users only" on public.companies;
drop policy "Enable update for authenticated users only" on public.companies;
drop policy "Company Delete Policy" on public.companies;
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (public.is_active_crm_user()) with check (public.is_active_crm_user());
create policy "Company Delete Policy" on public.companies for delete to authenticated using (public.is_active_crm_user());

drop policy "Enable read access for authenticated users" on public.contacts;
drop policy "Enable insert for authenticated users only" on public.contacts;
drop policy "Enable update for authenticated users only" on public.contacts;
drop policy "Contact Delete Policy" on public.contacts;
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (public.is_active_crm_user()) with check (public.is_active_crm_user());
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (public.is_active_crm_user());

drop policy "Enable read access for authenticated users" on public.contact_notes;
drop policy "Enable insert for authenticated users only" on public.contact_notes;
drop policy "Contact Notes Update policy" on public.contact_notes;
drop policy "Contact Notes Delete Policy" on public.contact_notes;
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (public.is_active_crm_user());
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (public.is_active_crm_user());
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (public.is_active_crm_user());

drop policy "Enable read access for deal assignees" on public.deals;
drop policy "Enable insert for authenticated users only" on public.deals;
drop policy "Enable update for deal assignees" on public.deals;
drop policy "Deals Delete Policy" on public.deals;
create policy "Enable read access for deal assignees" on public.deals for select to authenticated
  using ((select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids));
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for deal assignees" on public.deals for update to authenticated
  using ((select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids))
  with check (public.is_active_crm_user());
create policy "Deals Delete Policy" on public.deals for delete to authenticated
  using ((select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids));

drop policy "Enable read access for authenticated users" on public.sales;
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (public.is_active_crm_user());

drop policy "Enable read access for authenticated users" on public.tags;
drop policy "Enable insert for authenticated users only" on public.tags;
drop policy "Enable update for authenticated users only" on public.tags;
drop policy "Enable delete for authenticated users only" on public.tags;
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (public.is_active_crm_user());
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.is_active_crm_user());

drop policy "Enable read access for deal assignees" on public.tasks;
drop policy "Enable insert for deal assignees" on public.tasks;
drop policy "Task Update Policy" on public.tasks;
drop policy "Task Delete Policy" on public.tasks;
create policy "Enable read access for deal assignees" on public.tasks for select to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Enable insert for deal assignees" on public.tasks for insert to authenticated
  with check (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Task Update Policy" on public.tasks for update to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Task Delete Policy" on public.tasks for delete to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));

drop policy "Enable read for authenticated" on public.configuration;
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (public.is_active_crm_user());

drop policy "Enable access for authenticated users only" on public.favicons_excluded_domains;
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated
  using (public.is_active_crm_user()) with check (public.is_active_crm_user());

revoke all on function public.cleanup_note_attachments() from public, anon, authenticated;
revoke all on function public.handle_contact_note_created_or_updated() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_update_user() from public, anon, authenticated;
revoke all on function public.is_active_crm_user() from public, anon;
grant execute on function public.is_active_crm_user() to authenticated, service_role;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.ensure_deal_next_action(bigint) from public, anon, authenticated;
revoke all on function public.handle_deal_next_action() from public, anon, authenticated;
revoke all on function public.set_task_due_date_default() from public, anon, authenticated;
revoke all on function public.handle_task_next_action() from public, anon, authenticated;
grant execute on function public.cleanup_note_attachments() to service_role;
grant execute on function public.handle_contact_note_created_or_updated() to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.handle_update_user() to service_role;
grant execute on function public.ensure_deal_next_action(bigint) to service_role;
grant execute on function public.handle_deal_next_action() to service_role;
grant execute on function public.set_task_due_date_default() to service_role;
grant execute on function public.handle_task_next_action() to service_role;

revoke all on table public.init_state from anon;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Give existing undated work a deliberate deadline before generating missing
-- next actions. UI-created work already requires a date; this repairs the old
-- Trello/manual backlog and future trigger writes keep it that way.
update public.tasks as task
set due_date = case
  when deal.expected_closing_date is not null
       and deal.expected_closing_date >= current_date
    then deal.expected_closing_date::timestamptz + interval '9 hours'
  when deal.stage in ('facturatie-live', 'informatie-pipeline')
    then now() + interval '1 day'
  else now() + interval '3 days'
end
from public.deals as deal
where task.deal_id = deal.id
  and task.done_date is null
  and task.due_date is null;

update public.tasks
set due_date = now() + interval '3 days'
where deal_id is null
  and done_date is null
  and due_date is null;

-- Backfill all existing active deals. The function is idempotent and leaves a
-- manual/Trello next step untouched.
select public.ensure_deal_next_action(id)
from public.deals
where archived_at is null;
