revoke update on table "public"."companies" from "anon";

revoke update on table "public"."companies" from "authenticated";

revoke update on table "public"."deals" from "anon";

revoke update on table "public"."deals" from "authenticated";

-- The revokes above strip the whole-table UPDATE grant added by
-- 20260703181600_grant_base_tables_to_api_roles.sql. Re-grant it for every
-- column except the moneybird bookkeeping ones (see 06_grants.sql) so a fresh
-- `supabase db reset` ends up in the same state as the incrementally-migrated
-- database this diff was generated against — without this, a from-scratch
-- replay would leave anon/authenticated with no UPDATE at all on these tables.
grant update ("id", "name", "company_id", "contact_ids", "category", "stage",
              "description", "amount", "created_at", "updated_at", "archived_at",
              "expected_closing_date", "sales_id", "index", "trello_card_id")
              on table "public"."deals" to "anon", "authenticated";

grant update ("id", "created_at", "name", "sector", "size", "linkedin_url", "website",
              "phone_number", "address", "zipcode", "city", "state_abbr", "sales_id",
              "context_links", "country", "description", "revenue", "tax_identifier",
              "logo") on table "public"."companies" to "anon", "authenticated";

alter table "public"."companies" add column "moneybird_contact_id" text;

alter table "public"."deals" add column "moneybird_estimate_claimed_at" timestamp with time zone;

alter table "public"."deals" add column "moneybird_estimate_created_by" bigint;

alter table "public"."deals" add column "moneybird_estimate_error" text;

alter table "public"."deals" add column "moneybird_estimate_id" text;

alter table "public"."deals" add column "moneybird_estimate_status" text;

CREATE UNIQUE INDEX uq__companies__moneybird_contact_id ON public.companies USING btree (moneybird_contact_id) WHERE (moneybird_contact_id IS NOT NULL);

CREATE UNIQUE INDEX uq__deals__moneybird_estimate_id ON public.deals USING btree (moneybird_estimate_id) WHERE (moneybird_estimate_id IS NOT NULL);

alter table "public"."deals" add constraint "deals_moneybird_estimate_created_by_fkey" FOREIGN KEY (moneybird_estimate_created_by) REFERENCES public.sales(id) not valid;

alter table "public"."deals" validate constraint "deals_moneybird_estimate_created_by_fkey";

alter table "public"."deals" add constraint "deals_moneybird_estimate_status_check" CHECK ((moneybird_estimate_status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."deals" validate constraint "deals_moneybird_estimate_status_check";


