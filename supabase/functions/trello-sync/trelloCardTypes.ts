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

export interface TrelloCardInput {
  id: string;
  name: string;
  idList: string;
  labelNames: string[];
  due: string | null;
  dueComplete: boolean;
  url: string;
  // The card's markdown description — used to enrich the deal description and
  // to look for a client website (for the company logo).
  desc: string;
  // URLs of the card's attachments — often the client's website, used as a
  // source for the company website/logo.
  attachmentUrls: string[];
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
