-- Een voorstel heeft geen eigen status.
--
-- "Niet doorgegaan" bestaat sinds vanmiddag, maar wanneer een voorstel de deur
-- uit ging en tot wanneer het geldt legde niemand vast. Een voorstel dat
-- verloopt is daardoor een verloren opdracht die niemand ziet gebeuren: de
-- opdracht blijft gewoon op "Nog niet bevestigd" staan, net als de opdracht
-- waar volgende week antwoord op komt.
alter table public.deals
    add column if not exists proposal_sent_at date,
    add column if not exists proposal_valid_until date;

-- Deze twee moeten wél in de kolomlijst: "grant all on table deals" dekt SELECT
-- op elke kolom, maar UPDATE en INSERT zijn per kolom opgesomd omdat de
-- moneybird_*-boekhoudkolommen daar bewust buiten blijven. Zonder deze regels
-- kan het formulier de datums lezen maar niet opslaan.
revoke update on table public.deals from anon, authenticated;
grant update (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal,
              start_date, delivery_date, client_updated_at, proposal_sent_at,
              proposal_valid_until) on table public.deals to anon, authenticated;

revoke insert on table public.deals from anon, authenticated;
grant insert (id, name, company_id, contact_ids, category, stage, description, amount,
              created_at, updated_at, archived_at, expected_closing_date, sales_id,
              index, trello_card_id, revenue_period, assignee_ids, on_hold, is_internal,
              start_date, delivery_date, client_updated_at, proposal_sent_at,
              proposal_valid_until) on table public.deals to anon, authenticated;
