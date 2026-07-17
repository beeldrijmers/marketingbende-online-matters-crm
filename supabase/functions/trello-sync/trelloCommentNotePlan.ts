import type { TrelloCommentInput } from "./trelloCardTypes.ts";

export interface ExistingTrelloNote {
  id: number;
  text: string | null;
  date: string | null;
  activity_source_author: string | null;
  source_event_id: string | null;
}

export interface PlannedTrelloNote {
  text: string;
  date: string;
  activity_source_author: string;
  source_event_id: string;
}

export interface TrelloCommentNotePlan {
  inserts: PlannedTrelloNote[];
  updates: Array<PlannedTrelloNote & { id: number }>;
  deleteIds: number[];
}

const noteText = (comment: TrelloCommentInput): string =>
  `[Trello - ${comment.authorName}]\n${comment.text}`;

const eventId = (comment: TrelloCommentInput): string => `trello:${comment.id}`;

const sameInstant = (left: string | null, right: string): boolean => {
  if (!left) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime === rightTime
  );
};

const isCommentEventId = (value: string | null): value is string => {
  if (!value?.startsWith("trello:")) return false;
  // Other Trello-owned notes use a second namespace segment, e.g.
  // trello:attachment:<id>. A comment action is exactly trello:<action-id>.
  return !value.slice("trello:".length).includes(":");
};

// Pure three-way planner. Exact legacy notes without a source id are claimed
// instead of duplicated; sourced notes are updated after comment edits and
// removed after comment deletion. Attachment notes are never touched.
export const planTrelloCommentNoteSync = (
  comments: TrelloCommentInput[],
  existingNotes: ExistingTrelloNote[],
): TrelloCommentNotePlan => {
  const byEventId = new Map(
    existingNotes
      .filter((note) => note.source_event_id)
      .map((note) => [note.source_event_id as string, note]),
  );
  const unusedLegacy = existingNotes.filter(
    (note) => note.source_event_id == null,
  );
  const expectedEventIds = new Set<string>();
  const inserts: PlannedTrelloNote[] = [];
  const updates: Array<PlannedTrelloNote & { id: number }> = [];
  const duplicateLegacyIds = new Set<number>();

  for (const comment of comments) {
    const expected: PlannedTrelloNote = {
      text: noteText(comment),
      date: comment.date,
      activity_source_author: comment.authorName.trim(),
      source_event_id: eventId(comment),
    };
    expectedEventIds.add(expected.source_event_id);

    let existing = byEventId.get(expected.source_event_id);
    const matchingLegacyIndexes = unusedLegacy.flatMap((note, index) =>
      note.text === expected.text && sameInstant(note.date, expected.date)
        ? [index]
        : [],
    );
    if (matchingLegacyIndexes.length > 0) {
      const legacyMatches = matchingLegacyIndexes.map(
        (index) => unusedLegacy[index],
      );
      if (!existing) existing = legacyMatches[0];

      // Before source_event_id existed, simultaneous imports could create the
      // exact same Trello note more than once. Keep/claim one canonical row and
      // remove only the redundant Trello-owned copies. Manual CRM notes never
      // enter this set because the caller filters on activity_source=trello.
      for (const legacy of existing === legacyMatches[0]
        ? legacyMatches.slice(1)
        : legacyMatches) {
        duplicateLegacyIds.add(legacy.id);
      }
      for (const index of matchingLegacyIndexes.reverse()) {
        unusedLegacy.splice(index, 1);
      }
    }

    if (!existing) {
      inserts.push(expected);
      continue;
    }
    if (
      existing.text !== expected.text ||
      !sameInstant(existing.date, expected.date) ||
      existing.activity_source_author !== expected.activity_source_author ||
      existing.source_event_id !== expected.source_event_id
    ) {
      updates.push({ id: existing.id, ...expected });
    }
  }

  const deleteIds = [
    ...existingNotes
      .filter(
        (note) =>
          isCommentEventId(note.source_event_id) &&
          !expectedEventIds.has(note.source_event_id),
      )
      .map((note) => note.id),
    ...duplicateLegacyIds,
  ];

  return { inserts, updates, deleteIds };
};
