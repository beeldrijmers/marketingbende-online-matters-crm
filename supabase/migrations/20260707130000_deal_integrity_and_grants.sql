-- Data-integrity + grant fixes from the CRM audit.

-- 1. [HIGH] A deal must never become invisible to everyone. set_deal_assignee
--    _default already refills an empty assignee_ids with the owner, but it only
--    fired on INSERT: an UPDATE that cleared the array (the deals UPDATE policy
--    has WITH CHECK (true)) left the deal permanently unreadable, even to its
--    editor. Fire the guard on UPDATE too.
create or replace trigger set_deal_assignee_default_trigger
    before insert or update on public.deals
    for each row execute function public.set_deal_assignee_default();

-- 2. [MEDIUM] cycle_monthly_deal now clears won_notified_at when it recycles a
--    monthly deal, so the "project afgerond" notification can be claimed once
--    PER cycle instead of once ever.
CREATE OR REPLACE FUNCTION "public"."cycle_monthly_deal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- A monthly recurring deal that reaches "Klaar" is not finished - the work
  -- recurs next month. Instead of letting it rest in the won stage, send it
  -- back to the start of the loopband, un-tick its Trello-synced steps and
  -- record the restart. Fires only on the actual transition into "won", so it
  -- runs once per completion (not on every save while already there).
  IF NEW.revenue_period = 'maandelijks'
     AND NEW.stage = 'won'
     AND OLD.stage IS DISTINCT FROM 'won' THEN
    NEW.stage := 'informatie-pipeline';
    -- Reset the once-per-cycle notification claim so the next completion of
    -- this recurring deal notifies the team lead again.
    NEW.won_notified_at := NULL;

    UPDATE public.tasks
      SET done_date = NULL
      WHERE deal_id = NEW.id AND source = 'trello' AND done_date IS NOT NULL;

    INSERT INTO public.deal_notes (deal_id, text, sales_id, date)
      VALUES (
        NEW.id,
        'Maandelijkse cyclus opnieuw gestart op ' || to_char(now(), 'DD-MM-YYYY') || '.',
        NEW.sales_id,
        now()
      );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. [MEDIUM] handle_new_user derives the collaborating party from the sign-up
--    email domain; Groeien met Ads (allowed by sales_partij_check) fell through
--    to 'marketingbende'. Add its branch.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
  derived_partij text;
begin
  select count(id) into sales_count
  from public.sales;

  -- Assign the collaborating party from the sign-up email domain, so a new
  -- Online Matters / Groeien met Ads account gets its own colour instead of the
  -- default.
  derived_partij := case
    when new.email like '%@onlinematters.nl' then 'online_matters'
    when new.email like '%@groeienmetads.nl' then 'groeien_met_ads'
    when new.email like '%@marketingbende.nl' then 'marketingbende'
    else 'marketingbende'
  end;

  insert into public.sales (first_name, last_name, email, user_id, administrator, partij)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end,
    derived_partij
  );
  return new;
end;
$$;

-- 4. [MEDIUM] The column-restricted deals grants missed start_date and
--    delivery_date (introduced as CRM-editable in 20260705094111), so clients
--    could never write or correct those dates. Re-run the revoke + re-grant
--    with the full column list.
revoke update on table public.deals from anon, authenticated;
grant update (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal,
              start_date, delivery_date) on table public.deals to anon, authenticated;
revoke insert on table public.deals from anon, authenticated;
grant insert (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal,
              start_date, delivery_date) on table public.deals to anon, authenticated;

-- 5. [LOW] tasks.contact_id had no index, while contacts_summary joins on it per
--    contact-list render and the FK cascade scans it on contact delete/merge.
create index if not exists tasks_contact_id_idx on public.tasks using btree (contact_id);
