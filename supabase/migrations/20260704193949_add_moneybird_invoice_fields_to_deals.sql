alter table "public"."deals" add column "moneybird_invoice_claimed_at" timestamp with time zone;

alter table "public"."deals" add column "moneybird_invoice_created_by" bigint;

alter table "public"."deals" add column "moneybird_invoice_error" text;

alter table "public"."deals" add column "moneybird_invoice_id" text;

alter table "public"."deals" add column "moneybird_invoice_status" text;

CREATE UNIQUE INDEX uq__deals__moneybird_invoice_id ON public.deals USING btree (moneybird_invoice_id) WHERE (moneybird_invoice_id IS NOT NULL);

alter table "public"."deals" add constraint "deals_moneybird_invoice_created_by_fkey" FOREIGN KEY (moneybird_invoice_created_by) REFERENCES public.sales(id) not valid;

alter table "public"."deals" validate constraint "deals_moneybird_invoice_created_by_fkey";

alter table "public"."deals" add constraint "deals_moneybird_invoice_status_check" CHECK ((moneybird_invoice_status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."deals" validate constraint "deals_moneybird_invoice_status_check";

-- Moneybird invoice bookkeeping columns are written exclusively by the
-- moneybird_invoice edge function (service role). They are intentionally NOT in
-- the re-granted client column list (see supabase/schemas/06_grants.sql), so no
-- extra revoke is needed here beyond the existing deals revoke/re-grant.
