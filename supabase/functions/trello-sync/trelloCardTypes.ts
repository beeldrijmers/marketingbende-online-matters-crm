export interface TrelloMemberInput {
  id: string;
  fullName: string;
}

export interface TrelloCheckItemInput {
  // The Trello checklist-item id. Stable across edits, so it is the
  // idempotency key we mirror onto tasks.trello_checkitem_id.
  id: string;
  // The step text.
  name: string;
  // Whether the item is ticked off in Trello (state === "complete").
  complete: boolean;
  // The Trello member id assigned to this specific item, if any.
  memberId: string | null;
  // The item's own due date, if set.
  due: string | null;
}

// A file physically uploaded to the Trello card (isUpload === true), as opposed
// to a pasted link. These are downloaded into the CRM and attached to the deal
// as notes, so the card's documents survive without Trello.
export interface TrelloUploadedAttachment {
  // Trello's attachment id: stable, and our idempotency key for the import.
  id: string;
  name: string;
  // The authenticated download URL (requires the OAuth key/token header).
  url: string;
  mimeType: string | null;
  bytes: number | null;
  // When the file was attached in Trello; preserved on the imported note.
  date: string | null;
  // The original file name (name can be a human-edited title).
  fileName: string | null;
}

// A Trello comment is both visible CRM history and deterministic source input
// for enrichment (amounts, recurring wording, contact details and explicitly
// labelled next steps). The action id stays stable when a comment is edited,
// so it doubles as the idempotency key for notes and derived tasks.
export interface TrelloCommentInput {
  id: string;
  date: string;
  authorName: string;
  text: string;
}

export interface TrelloCardInput {
  id: string;
  name: string;
  idList: string;
  labelNames: string[];
  // Trello's native project start date. When present it enriches the CRM's
  // start_date, so the deal detail can show the planned/actual duration.
  start: string | null;
  due: string | null;
  dueComplete: boolean;
  // Whether the card is archived in Trello. An archived card's deal is
  // archived in the CRM instead of being (re)synced onto the board.
  closed: boolean;
  url: string;
  // The card's markdown description — used to enrich the deal description and
  // to look for a client website (for the company logo).
  desc: string;
  // Oldest first. Optional because the raw card endpoints do not embed the
  // complete action history; fetchTrelloCardWithComments enriches the card
  // before it reaches the sync. Keeping it optional also makes a partial
  // Trello response safe: missing comments never masquerade as an empty,
  // authoritative history.
  comments?: TrelloCommentInput[];
  // URLs of the card's attachments — often the client's website, used as a
  // source for the company website/logo.
  attachmentUrls: string[];
  // Real uploaded files on the card, imported into the CRM as deal notes.
  uploadedAttachments: TrelloUploadedAttachment[];
  // The people assigned to the card as a whole — used to attribute the card's
  // steps (tasks) to the right CRM user.
  members: TrelloMemberInput[];
  // Every checklist item on the card, flattened across all checklists. These
  // become the deal's steps ("wat moet er nog gebeuren").
  checkItems: TrelloCheckItemInput[];
  // Whether the Trello response actually carried a `checklists` array. Lets the
  // sync tell "this card genuinely has no checklists" (safe to delete orphaned
  // steps) apart from "the field was missing from a malformed response" (do not
  // delete anything), so a partial response can never wipe a deal's steps.
  checklistsPresent: boolean;
}
