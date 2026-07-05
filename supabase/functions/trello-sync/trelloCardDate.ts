// Pure helper: recover a Trello card's real creation date from its id.
//
// Trello ids are MongoDB ObjectIds: the first 8 hex characters encode the
// creation time as a Unix timestamp in seconds. Using this lets a synced deal
// carry the date the project actually started on Trello, instead of defaulting
// created_at to the (much later) import/backfill time — so long-running
// projects no longer all look like they began on the import date.
//
// Returns an ISO-8601 string, or null when the id is not a parseable ObjectId
// or the decoded time is implausible (before 2010, after the current clock).

// Trello (Atlassian) predates 2010; anything earlier is a decoding artefact.
const MIN_PLAUSIBLE_MS = Date.UTC(2010, 0, 1);

export const trelloCardCreatedAt = (
  id: string,
  now: number = Date.now(),
): string | null => {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{8}/.test(id)) {
    return null;
  }
  const seconds = Number.parseInt(id.slice(0, 8), 16);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const ms = seconds * 1000;
  // Reject clearly-wrong values: before Trello existed or in the future.
  if (ms < MIN_PLAUSIBLE_MS || ms > now) {
    return null;
  }
  return new Date(ms).toISOString();
};
