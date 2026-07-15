import type { NormalizedInboundEmail } from "../inbound/processInboundEmail.ts";

export interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  historyId?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
}

const decodeBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const header = (payload: GmailMessagePart | undefined, name: string): string =>
  payload?.headers?.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  )?.value ?? "";

const splitAddresses = (value: string): string[] => {
  if (!value.trim()) return [];
  // A comma inside a quoted display name is not an address separator.
  const addresses: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === "," && !quoted) {
      if (current.trim()) addresses.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) addresses.push(current.trim());
  return addresses;
};

type AttachmentLoader = (attachmentId: string) => Promise<string>;

const findBody = async (
  part: GmailMessagePart | undefined,
  mimeType: "text/plain" | "text/html",
  loadAttachment: AttachmentLoader,
): Promise<string> => {
  if (!part) return "";
  if (part.mimeType?.toLowerCase() === mimeType) {
    if (part.body?.data) return decodeBase64Url(part.body.data);
    if (part.body?.attachmentId) {
      const data = await loadAttachment(part.body.attachmentId);
      return data ? decodeBase64Url(data) : "";
    }
  }
  for (const child of part.parts ?? []) {
    const result = await findBody(child, mimeType, loadAttachment);
    if (result) return result;
  }
  return "";
};

export const normalizeGmailMessage = async (
  message: GmailMessage,
  loadAttachment: AttachmentLoader = async () => "",
): Promise<NormalizedInboundEmail> => {
  const text = await findBody(message.payload, "text/plain", loadAttachment);
  const html = await findBody(message.payload, "text/html", loadAttachment);
  return {
    from: header(message.payload, "From"),
    to: splitAddresses(header(message.payload, "To")),
    cc: splitAddresses(header(message.payload, "Cc")),
    subject: header(message.payload, "Subject"),
    text,
    html,
  };
};
