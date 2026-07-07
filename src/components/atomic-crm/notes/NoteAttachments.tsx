import { Paperclip } from "lucide-react";

import type { AttachmentNote, ContactNote, DealNote } from "../types";
import { useSignedAttachmentUrl } from "./useSignedAttachmentUrl";

/**
 * Displays persisted note attachments in note show/list views.
 *
 * This component receives a full note record and renders all attachments.
 * The attachments bucket is private, so each attachment is served through a
 * short-lived signed URL resolved from its stored path (see
 * {@link useSignedAttachmentUrl}).
 *
 * @param props.note - Note record containing attachments to render.
 * @returns `null` when there are no attachments, otherwise attachment previews and links.
 */
export const NoteAttachments = ({ note }: { note: ContactNote | DealNote }) => {
  if (!note.attachments || note.attachments.length === 0) {
    return null;
  }

  const imageAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => isImageMimeType(attachment.type),
  );
  const otherAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => !isImageMimeType(attachment.type),
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      {imageAttachments.length > 0 && (
        <div className="grid grid-cols-4 gap-8">
          {imageAttachments.map((attachment: AttachmentNote, index: number) => (
            <ImageAttachment key={index} attachment={attachment} />
          ))}
        </div>
      )}
      {otherAttachments.length > 0 &&
        otherAttachments.map((attachment: AttachmentNote, index: number) => (
          <FileAttachment key={index} attachment={attachment} />
        ))}
    </div>
  );
};

const ImageAttachment = ({ attachment }: { attachment: AttachmentNote }) => {
  const url = useSignedAttachmentUrl(attachment);
  return (
    <div>
      <a
        href={url}
        title={attachment.title}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={attachment.title}
          className="w-[200px] h-[100px] object-cover cursor-pointer object-left border border-border"
        />
      </a>
    </div>
  );
};

const FileAttachment = ({ attachment }: { attachment: AttachmentNote }) => {
  const url = useSignedAttachmentUrl(attachment);
  return (
    <div className="flex items-center gap-2">
      <Paperclip className="w-4 h-4" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline"
        onClick={(e) => e.stopPropagation()}
      >
        {attachment.title}
      </a>
    </div>
  );
};

/**
 * Checks whether a mime type corresponds to an image.
 *
 * @param mimeType - The attachment mime type.
 * @returns `true` when the mime type starts with `image/`.
 */
const isImageMimeType = (mimeType?: string): boolean => {
  if (!mimeType) {
    return false;
  }
  return mimeType.startsWith("image/");
};
