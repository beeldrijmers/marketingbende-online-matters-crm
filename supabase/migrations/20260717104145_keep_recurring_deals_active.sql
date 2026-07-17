CREATE OR REPLACE FUNCTION "public"."cycle_monthly_deal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- A monthly recurring deal that reaches "Klaar" is not finished - the work
  -- recurs next month. Return it to Bezig, reset its Trello-synced steps and
  -- record the restart. Fires only on the actual transition into "won", so it
  -- runs once per completion (not on every save while already there).
  IF NEW.revenue_period = 'maandelijks'
     AND NEW.stage = 'won'
     AND OLD.stage IS DISTINCT FROM 'won' THEN
    NEW.stage := 'bezig';
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
