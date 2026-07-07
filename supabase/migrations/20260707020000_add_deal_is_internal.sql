-- Internal vs external work on deals, driving the Intern/Extern board filter.
alter table "public"."deals"
  add column "is_internal" boolean not null default false;

-- Allow client roles to write the new column (mirrors the deals column grants).
revoke update on table public.deals from anon, authenticated;
grant update (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal) on table public.deals to anon, authenticated;
revoke insert on table public.deals from anon, authenticated;
grant insert (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal) on table public.deals to anon, authenticated;

-- First-pass classification: internal = Happr product work, the Lightspeed POS
-- integration (Happr), and Marketingbende/Online Matters' own projects.
-- Everything else is external client work. Editable per card afterwards.
update public.deals
set is_internal = (
  category = 'happr'
  or name ilike '%lightspeed%'
  or company_id in (
    select id from public.companies
    where name ilike 'Marketingbende%' or name ilike 'Online Matters%'
  )
);
