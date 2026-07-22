--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.moneybird_connections enable row level security;
alter table public.moneybird_company_contacts enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.gmail_oauth_states enable row level security;
-- No client policies: the inbound-email idempotency ledger is written only by
-- the webhook (service_role, which bypasses RLS). RLS-on + no-policy means
-- anon/authenticated can neither read nor write it.
alter table public.inbound_email_events enable row level security;
alter table public.integration_runs enable row level security;
alter table public.inzyte_links enable row level security;
alter table public.inzyte_runs enable row level security;

-- Integration history contains operational metadata but no credentials. It is
-- visible to active CRM users; only edge functions write it (no write policy).
create policy "Enable read access for active CRM users" on public.integration_runs
    for select to authenticated using (public.is_active_crm_user());

-- Inzyte links and snapshots follow the visibility of their assignment. All
-- mutations are service-role only through the edge function.
create policy "Enable read access for visible Inzyte assignments" on public.inzyte_links
    for select to authenticated using (deal_id in (select id from public.deals));
create policy "Enable read access for visible Inzyte runs" on public.inzyte_runs
    for select to authenticated using (deal_id in (select id from public.deals));

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (public.is_active_crm_user()) with check (public.is_active_crm_user());
create policy "Company Delete Policy" on public.companies for delete to authenticated using (public.is_active_crm_user());

-- Contacts
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (public.is_active_crm_user()) with check (public.is_active_crm_user());
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (public.is_active_crm_user());

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (public.is_active_crm_user());
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (public.is_active_crm_user());
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (public.is_active_crm_user());

-- Deals: administrators can oversee and manage the complete shared Trello
-- board. Other users only see and manage deals assigned to them. assignee_ids
-- remains the card's ownership/access-control list for non-admin users; the
-- default-assignee trigger (set_sales_id_default) makes every new deal
-- assigned to at least its owner, so nothing is created invisible. The
-- moneybird/trello/inbound edge functions run as service_role and bypass RLS,
-- so the sync/document flows are unaffected. Insert stays open (the creator
-- assigns themselves via the trigger/form); the read policy then governs
-- whether they see it back.
create policy "Enable read access for deal assignees" on public.deals for select to authenticated
  using (public.is_admin() or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids));
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for deal assignees" on public.deals for update to authenticated
  using (public.is_admin() or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids))
  with check (public.is_active_crm_user());
create policy "Deals Delete Policy" on public.deals for delete to authenticated
  using (public.is_admin() or (select id from public.sales where user_id = (select auth.uid()) and disabled = false) = any (assignee_ids));

-- Deal Notes: a note follows its deal's visibility. The subquery on deals is
-- itself under the deals RLS, so "deal_id in (select id from public.deals)"
-- resolves to exactly the deals the caller may see - the note content (which is
-- where the real deal information lives) is never readable for a deal the user
-- is not assigned to, whether via PostgREST or the activity_log view.
create policy "Enable read access for deal assignees" on public.deal_notes for select to authenticated
  using (deal_id in (select id from public.deals));
create policy "Enable insert for deal assignees" on public.deal_notes for insert to authenticated
  with check (deal_id in (select id from public.deals));
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated
  using (deal_id in (select id from public.deals));
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated
  using (deal_id in (select id from public.deals));

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (public.is_active_crm_user());

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (public.is_active_crm_user());
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (public.is_active_crm_user());
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.is_active_crm_user());

-- Tasks: a deal-linked task follows its deal's visibility; contact-only tasks
-- (deal_id null) stay visible to all, since contacts are not access-restricted.
-- The deals subquery is under RLS, so deal tasks are hidden for deals the user
-- is not assigned to.
create policy "Enable read access for deal assignees" on public.tasks for select to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Enable insert for deal assignees" on public.tasks for insert to authenticated
  with check (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Task Update Policy" on public.tasks for update to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));
create policy "Task Delete Policy" on public.tasks for delete to authenticated
  using (public.is_active_crm_user() and (deal_id is null or deal_id in (select id from public.deals)));

-- Configuration (admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (public.is_active_crm_user());
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (public.is_active_crm_user()) with check (public.is_active_crm_user());

-- Moneybird connections (owner-only: a user may only see their own connection
-- row; the encrypted token column is additionally hidden from client roles via
-- column-level grants, see 06_grants.sql). All writes go through the
-- moneybird_connection edge function (service role, bypasses RLS), so there are
-- deliberately NO insert/update/delete policies for authenticated.
create policy "Enable read access for connection owner" on public.moneybird_connections for select to authenticated
    using (sales_id in (select id from public.sales where user_id = (select auth.uid())));

-- Gmail connection metadata is owner-readable, but refresh tokens are also
-- hidden at the grant layer. OAuth state and every write stay service-role only.
create policy "Enable read access for Gmail connection owner" on public.gmail_connections for select to authenticated
    using (sales_id in (select id from public.sales where user_id = (select auth.uid())));

-- Moneybird company contacts: a server-side cache used exclusively by the
-- moneybird edge functions (service role). No client policies at all.
