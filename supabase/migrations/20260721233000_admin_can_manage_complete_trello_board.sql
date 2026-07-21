-- The CRM administrator is responsible for the complete operational workflow
-- and therefore needs a truthful whole-board dashboard. Team members keep
-- the existing least-privilege behaviour: they only see assigned cards.

drop policy if exists "Enable read access for deal assignees" on public.deals;
create policy "Enable read access for deal assignees" on public.deals
  for select to authenticated
  using (
    public.is_admin()
    or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids)
  );
drop policy if exists "Enable update for deal assignees" on public.deals;
create policy "Enable update for deal assignees" on public.deals
  for update to authenticated
  using (
    public.is_admin()
    or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids)
  )
  with check (public.is_active_crm_user());

drop policy if exists "Deals Delete Policy" on public.deals;
create policy "Deals Delete Policy" on public.deals
  for delete to authenticated
  using (
    public.is_admin()
    or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids)
  );
