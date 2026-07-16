-- Gmail mailbox access must never imply permission to create CRM records from
-- every message. Connections stay paused until their owner selects a custom
-- Gmail label as the explicit import boundary.
alter table public.gmail_connections
  add column if not exists sync_label_id text,
  add column if not exists sync_label_name text;

alter table public.gmail_connections
  drop constraint if exists gmail_connections_sync_status_check;

alter table public.gmail_connections
  add constraint gmail_connections_sync_status_check
  check (sync_status in ('connected', 'syncing', 'error', 'needs_label'));

alter table public.gmail_connections
  alter column sync_status set default 'needs_label';

-- Protect every existing connection before the next scheduled run. Its current
-- history cursor is retained; selecting a label later establishes a new fresh
-- cursor in the edge function, so historic mailbox traffic is not backfilled.
update public.gmail_connections
set
  sync_label_id = null,
  sync_label_name = null,
  sync_status = 'needs_label',
  last_synced_at = null,
  last_error = null,
  updated_at = now();

-- The client needs label metadata for Settings, never the token or cursor.
grant select (sync_label_id, sync_label_name)
  on table public.gmail_connections to authenticated;
