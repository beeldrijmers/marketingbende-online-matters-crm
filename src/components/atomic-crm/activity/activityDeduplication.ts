import { CONTACT_NOTE_CREATED, DEAL_NOTE_CREATED } from "../consts";
import type { Activity } from "../types";

const sourceEventIdOf = (activity: Activity): string | null | undefined => {
  if (activity.type === CONTACT_NOTE_CREATED) {
    return activity.contactNote.source_event_id;
  }
  if (activity.type === DEAL_NOTE_CREATED) {
    return activity.dealNote.source_event_id;
  }
  return null;
};

/**
 * Keeps the newest row for every provider event in a date-descending global
 * activity list. Source-less/manual activities are never guessed or grouped.
 */
export const dedupeActivitiesBySourceEvent = (
  activities: Activity[],
): Activity[] => {
  const seen = new Set<string>();
  return activities.filter((activity) => {
    const sourceEventId = sourceEventIdOf(activity)?.trim();
    if (!sourceEventId) return true;
    if (seen.has(sourceEventId)) return false;
    seen.add(sourceEventId);
    return true;
  });
};
