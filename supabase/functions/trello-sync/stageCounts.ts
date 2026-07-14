export const TRELLO_SYNC_STAGES = [
  "informatie-pipeline",
  "bezig",
  "on-hold",
  "facturatie-live",
  "won",
] as const;

export type TrelloSyncStage = (typeof TRELLO_SYNC_STAGES)[number];
export type TrelloSyncStageCounts = Record<TrelloSyncStage, number>;

export const emptyTrelloSyncStageCounts = (): TrelloSyncStageCounts => ({
  "informatie-pipeline": 0,
  bezig: 0,
  "on-hold": 0,
  "facturatie-live": 0,
  won: 0,
});

// Counts the final CRM placement, ignoring any legacy/unknown stage instead of
// making the whole sync summary fail. The database constraint normally makes
// that impossible, but old data should never break a user-facing sync result.
export const countTrelloSyncStages = (
  rows: Array<{ stage: string | null }>,
): TrelloSyncStageCounts => {
  const counts = emptyTrelloSyncStageCounts();
  for (const { stage } of rows) {
    if (stage && TRELLO_SYNC_STAGES.includes(stage as TrelloSyncStage)) {
      counts[stage as TrelloSyncStage] += 1;
    }
  }
  return counts;
};
