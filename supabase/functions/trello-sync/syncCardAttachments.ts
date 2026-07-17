// Imports a Trello card's uploaded files into the CRM: each file is downloaded
// from Trello (authenticated), stored in the Supabase "attachments" bucket and
// attached to the deal as a note, so the card's documents live in the CRM and
// no longer depend on Trello.
//
// Idempotent per attachment: every imported note carries a
// "[trello-bijlage:<id>]" marker; an attachment whose marker already exists on
// the deal is skipped, and the storage object name is derived from the
// attachment id so a retried upload can never duplicate the file either.
//
// BEST-EFFORT by design: attachment import must never fail the sync of the
// deal itself (webhook retries would duplicate other work). Failures are
// logged per attachment and skipped. Returns the number of newly imported
// attachments.

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveDefaultSalesId } from "./resolveDefaultSalesId.ts";
import type { TrelloUploadedAttachment } from "./trelloCardTypes.ts";

// Trello attachment downloads require the key/token as an OAuth header (query
// params are not accepted on the download endpoint).
const trelloAuthHeader = (apiKey: string, token: string): string =>
  `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`;

// Anything bigger is skipped (and logged): the CRM is not a video archive, and
// edge functions hold the file in memory during the transfer.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const attachmentMarker = (attachmentId: string): string =>
  `[trello-bijlage:${attachmentId}]`;

export const attachmentNoteText = (
  attachment: Pick<TrelloUploadedAttachment, "id" | "name">,
): string => `[Trello - bijlage] ${attachment.name}

${attachmentMarker(attachment.id)}`;

// Deterministic storage object name: retries overwrite nothing and create no
// duplicates. The extension is kept so previews/downloads behave.
export const storageNameFor = (
  attachment: Pick<TrelloUploadedAttachment, "id" | "name" | "fileName">,
): string => {
  const source = attachment.fileName || attachment.name || "";
  const dotIndex = source.lastIndexOf(".");
  const extension =
    dotIndex > 0 && dotIndex < source.length - 1
      ? source.slice(dotIndex).toLowerCase()
      : "";
  return `trello-${attachment.id}${extension}`;
};

// Reads a response body while enforcing the size limit, also for downloads
// where Trello reported no `bytes` and the response carries no Content-Length:
// the body is streamed in chunks and abandoned the moment it exceeds the cap,
// so an unexpectedly huge file can never balloon the function's memory.
// Returns null when the download is too big.
export const readBodyWithCap = async (
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | null> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? null : buffer;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
};

export const syncCardAttachments = async ({
  dealId,
  attachments,
  apiKey,
  token,
}: {
  dealId: number;
  attachments: TrelloUploadedAttachment[];
  apiKey: string;
  token: string;
}): Promise<number> => {
  if (!attachments.length) return 0;

  let imported = 0;
  for (const attachment of attachments) {
    try {
      if (
        attachment.bytes !== null &&
        attachment.bytes > MAX_ATTACHMENT_BYTES
      ) {
        console.warn(
          `Skipping Trello attachment ${attachment.id} (${attachment.name}): ${attachment.bytes} bytes exceeds the import limit`,
        );
        continue;
      }

      // Idempotency: skip when this attachment's marker already exists on the
      // deal (imported by an earlier sync or backfill run).
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("deal_notes")
        .select("id")
        .eq("deal_id", dealId)
        .like("text", `%${attachmentMarker(attachment.id)}%`)
        .limit(1)
        .maybeSingle();
      if (existingError) {
        throw new Error(
          `Could not check for an existing note: ${existingError.message}`,
        );
      }
      if (existing) continue;

      const response = await fetch(attachment.url, {
        headers: { Authorization: trelloAuthHeader(apiKey, token) },
      });
      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} ${await response.text()}`,
        );
      }
      // The `bytes` check above is advisory (Trello may report null); the
      // actual download is what must never exceed the limit.
      const content = await readBodyWithCap(response, MAX_ATTACHMENT_BYTES);
      if (content === null) {
        console.warn(
          `Skipping Trello attachment ${attachment.id} (${attachment.name}): download exceeds the import limit`,
        );
        continue;
      }

      const objectName = storageNameFor(attachment);
      const contentType = attachment.mimeType || "application/octet-stream";
      const { error: uploadError } = await supabaseAdmin.storage
        .from("attachments")
        .upload(objectName, content, { contentType, upsert: true });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // The attachments bucket is private; a public URL would not resolve. The
      // note stores the path (the frontend signs a short-lived URL from it at
      // display time); a signed URL is generated here just as an initial src.
      const { data: signed } = await supabaseAdmin.storage
        .from("attachments")
        .createSignedUrl(objectName, 60 * 60);

      const { error: noteError } = await supabaseAdmin
        .from("deal_notes")
        .insert({
          deal_id: dealId,
          text: attachmentNoteText(attachment),
          sales_id: await resolveDefaultSalesId(),
          activity_source: "trello",
          source_event_id: `trello:attachment:${attachment.id}`,
          attachments: [
            {
              title: attachment.name,
              type: contentType,
              path: objectName,
              src: signed?.signedUrl ?? "",
            },
          ],
          // Preserve when the file was attached in Trello; the DB default
          // (now()) applies for attachments without a date.
          ...(attachment.date ? { date: attachment.date } : {}),
        });
      // A second concurrent card webhook may have passed the marker lookup
      // before the first inserted. The source-event unique index picks one.
      if (noteError?.code === "23505") continue;
      if (noteError) {
        throw new Error(`Note insert failed: ${noteError.message}`);
      }

      imported += 1;
    } catch (error) {
      console.error(
        `Could not import Trello attachment ${attachment.id} (${attachment.name}) for deal ${dealId} (best-effort):`,
        error,
      );
    }
  }
  return imported;
};
