-- The attachments bucket was public (init migration set public = true), so
-- every uploaded file was reachable by its URL WITHOUT authentication, fully
-- bypassing the per-party RLS on deal_notes/contact_notes. Make it private: the
-- frontend now serves attachments through short-lived signed URLs
-- (createSignedUrl), which require an authenticated session. The existing
-- bucket-level policies (authenticated may select/insert/delete) already gate
-- who can sign/upload/remove; anonymous access is closed by the private flag.
update storage.buckets set public = false where id = 'attachments';
