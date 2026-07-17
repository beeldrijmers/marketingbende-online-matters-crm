--
-- Triggers
-- This file declares all triggers.
--

-- Auto-populate sales_id from current auth user on insert
create or replace trigger set_company_sales_id_trigger
    before insert on public.companies
    for each row execute function public.set_sales_id_default();

create or replace trigger set_contact_sales_id_trigger
    before insert on public.contacts
    for each row execute function public.set_sales_id_default();

create or replace trigger set_contact_notes_sales_id_trigger
    before insert on public.contact_notes
    for each row execute function public.set_sales_id_default();

create or replace trigger set_deal_sales_id_trigger
    before insert on public.deals
    for each row execute function public.set_sales_id_default();

-- Defaults assignee_ids to the deal's owner. Order-independent: the function
-- resolves the owner itself, so it does not matter whether this fires before or
-- after set_deal_sales_id_trigger. Fires on UPDATE too, so an update that
-- empties assignee_ids (the UPDATE policy has WITH CHECK (true)) can never make
-- a deal permanently invisible to everyone.
create or replace trigger set_deal_assignee_default_trigger
    before insert or update on public.deals
    for each row execute function public.set_deal_assignee_default();

-- Sends a monthly recurring deal back to Bezig when it is marked "Klaar",
-- resetting its Trello-synced steps (see cycle_monthly_deal).
create or replace trigger cycle_monthly_deal_trigger
    before update on public.deals
    for each row execute function public.cycle_monthly_deal();

-- Keeps deals.on_hold in sync with the "In de wacht" stage. Fires on insert and
-- update; named to sort after cycle_monthly_deal_trigger so it sees the final
-- stage.
create or replace trigger sync_deal_on_hold_trigger
    before insert or update on public.deals
    for each row execute function public.sync_deal_on_hold();

-- Keep every actionable deal supplied with one dated next step. A concrete
-- manual or Trello task replaces the generic automatic reminder.
create or replace trigger ensure_deal_next_action_trigger
    after insert or update of stage, expected_closing_date, archived_at, sales_id on public.deals
    for each row execute function public.handle_deal_next_action();

create or replace trigger set_deal_notes_sales_id_trigger
    before insert on public.deal_notes
    for each row execute function public.set_sales_id_default();

create or replace trigger set_task_sales_id_trigger
    before insert on public.tasks
    for each row execute function public.set_sales_id_default();

create or replace trigger set_task_due_date_default_trigger
    before insert or update of deal_id, due_date on public.tasks
    for each row execute function public.set_task_due_date_default();

create or replace trigger ensure_next_action_after_task_change_trigger
    after insert or update of deal_id, done_date or delete on public.tasks
    for each row execute function public.handle_task_next_action();

-- Auto-fetch company logo from website favicon on save
create or replace trigger company_saved
    before insert or update on public.companies
    for each row execute function public.handle_company_saved();

-- Lowercase contact emails before insert or update (must run before contact_saved)
create or replace trigger "10_lowercase_contact_emails"
    before insert or update on public.contacts
    for each row execute function public.lowercase_email_jsonb();

-- Auto-fetch contact avatar from email on save (runs after lowercase_contact_emails)
create or replace trigger "20_contact_saved"
    before insert or update on public.contacts
    for each row execute function public.handle_contact_saved();

-- Update contact.last_seen when a contact note is created
create or replace trigger on_public_contact_notes_created_or_updated
    after insert on public.contact_notes
    for each row execute function public.handle_contact_note_created_or_updated();

-- Cleanup storage attachments when contact notes are updated or deleted
create or replace trigger on_contact_notes_attachments_updated_delete_note_attachments
    after update on public.contact_notes
    for each row
    when (old.attachments is distinct from new.attachments)
    execute function public.cleanup_note_attachments();

create or replace trigger on_contact_notes_deleted_delete_note_attachments
    after delete on public.contact_notes
    for each row execute function public.cleanup_note_attachments();

-- Cleanup storage attachments when deal notes are updated or deleted
create or replace trigger on_deal_notes_attachments_updated_delete_note_attachments
    after update on public.deal_notes
    for each row
    when (old.attachments is distinct from new.attachments)
    execute function public.cleanup_note_attachments();

create or replace trigger on_deal_notes_deleted_delete_note_attachments
    after delete on public.deal_notes
    for each row execute function public.cleanup_note_attachments();

-- Auth triggers: sync auth.users to public.sales
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace trigger on_auth_user_updated
    after update on auth.users
    for each row execute function public.handle_update_user();
