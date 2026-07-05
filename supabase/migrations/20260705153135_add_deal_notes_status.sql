-- Allow deal notes to carry a status (contact notes already have one). Nullable;
-- a status set + composer UI can be wired later.
alter table public.deal_notes
    add column if not exists status text;
