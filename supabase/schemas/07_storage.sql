--
-- Storage
-- This file declares storage bucket policies.
--
-- The attachments bucket is PRIVATE (see 20260707150000): files are served via
-- short-lived signed URLs, so they are never reachable without an authenticated
-- session. The policies below gate who may sign/upload/delete.

create policy "Attachments 1mt4rzk_0" on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "Attachments 1mt4rzk_1" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "Attachments 1mt4rzk_3" on storage.objects for delete to authenticated using (bucket_id = 'attachments');
