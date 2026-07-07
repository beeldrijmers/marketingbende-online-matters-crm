import { useQuery } from "@tanstack/react-query";

import { ATTACHMENTS_BUCKET } from "../providers/commons/attachments";
import { getSupabaseClient } from "../providers/supabase/supabase";
import type { AttachmentNote } from "../types";

// How long a signed attachment URL stays valid. Long enough to open/preview
// comfortably; the URL is re-signed on the next render anyway.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Resolves the URL to display/download an attachment. The attachments bucket is
// private, so a stored `path` is turned into a short-lived signed URL at read
// time. Falls back to the record's `src` when there is no path (e.g. demo/
// FakeRest data: URLs, or a legacy record) so display never hard-breaks.
export const useSignedAttachmentUrl = (attachment: AttachmentNote): string => {
  const path = attachment.path;
  const { data } = useQuery({
    queryKey: ["attachment_signed_url", path],
    enabled: Boolean(path),
    // Refresh a little before the URL actually expires.
    staleTime: (SIGNED_URL_TTL_SECONDS - 60) * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .storage.from(ATTACHMENTS_BUCKET)
        .createSignedUrl(path as string, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        // Fall back to the stored src rather than failing the render.
        return attachment.src;
      }
      return data.signedUrl;
    },
  });

  if (!path) return attachment.src;
  return data ?? attachment.src;
};
