import type { TrelloCardInput } from "./trelloCardTypes.ts";

// The subset of Trello's REST card shape we consume. Both the single-card fetch
// (webhook path) and the bulk board fetch (backfill path) request these fields
// and parse them through this one function, so the two paths can never drift.
export interface TrelloApiCard {
  id: string;
  name: string;
  idList: string;
  due: string | null;
  dueComplete: boolean;
  closed?: boolean;
  shortUrl: string;
  desc: string | null;
  labels?: { name: string }[];
  attachments?: {
    id?: string;
    url: string;
    name: string;
    isUpload?: boolean;
    mimeType?: string | null;
    bytes?: number | null;
    date?: string | null;
    fileName?: string | null;
  }[];
  members?: { id: string; fullName: string }[];
  checklists?: {
    id: string;
    name: string;
    checkItems?: {
      id: string;
      name: string;
      state: string;
      due: string | null;
      idMember: string | null;
    }[];
  }[];
}

export const parseTrelloApiCard = (card: TrelloApiCard): TrelloCardInput => ({
  id: card.id,
  name: card.name,
  idList: card.idList,
  labelNames: (card.labels ?? []).map((label) => label.name),
  due: card.due,
  dueComplete: card.dueComplete,
  closed: card.closed ?? false,
  url: card.shortUrl,
  desc: card.desc ?? "",
  attachmentUrls: (card.attachments ?? [])
    .map((attachment) => attachment.url)
    .filter(Boolean),
  // Only real uploads (isUpload) become CRM attachments; pasted links stay in
  // attachmentUrls for the website/logo heuristics above.
  uploadedAttachments: (card.attachments ?? [])
    .filter((attachment) => attachment.isUpload && attachment.id)
    .map((attachment) => ({
      id: attachment.id as string,
      name: attachment.name,
      url: attachment.url,
      mimeType: attachment.mimeType ?? null,
      bytes: attachment.bytes ?? null,
      date: attachment.date ?? null,
      fileName: attachment.fileName ?? null,
    })),
  members: (card.members ?? []).map((member) => ({
    id: member.id,
    fullName: member.fullName,
  })),
  // Flatten every checklist's items into a single ordered list of steps.
  checkItems: (card.checklists ?? []).flatMap((checklist) =>
    (checklist.checkItems ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      complete: item.state === "complete",
      memberId: item.idMember ?? null,
      due: item.due ?? null,
    })),
  ),
  checklistsPresent: Array.isArray(card.checklists),
});
