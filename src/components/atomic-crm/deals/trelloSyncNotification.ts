import type { CrmDataProvider } from "../providers/types";

type TrelloSyncSummary = Awaited<
  ReturnType<CrmDataProvider["syncTrelloCards"]>
>;

export const formatTrelloSyncDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} min ${seconds} sec` : `${minutes} min`;
};

export const formatTrelloStageCounts = (
  stageCounts: TrelloSyncSummary["stageCounts"],
): string =>
  [
    ["Nieuw", stageCounts["informatie-pipeline"]],
    ["Bezig", stageCounts.bezig],
    ["In de wacht", stageCounts["on-hold"]],
    ["Facturatie & live", stageCounts["facturatie-live"]],
    ["Klaar", stageCounts.won],
  ]
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");

export const getTrelloSyncNotification = (
  summary: TrelloSyncSummary,
  localizedStageSummary?: string,
) => {
  const failed = summary.failed ?? [];
  const duration = formatTrelloSyncDuration(summary.durationMs);
  const stageCounts = summary.stageCounts ?? {
    "informatie-pipeline": 0,
    bezig: 0,
    "on-hold": 0,
    "facturatie-live": 0,
    won: 0,
  };
  const stageSummary =
    localizedStageSummary ?? formatTrelloStageCounts(stageCounts);

  if (failed.length === 0) {
    return {
      message: "resources.deals.trello_sync.success",
      type: "success" as const,
      messageArgs: {
        smart_count: summary.synced,
        duration,
        stage_summary: stageSummary,
        _:
          summary.synced === 1
            ? `Trello gesynchroniseerd: 1 kaart in ${duration}. ${stageSummary}`
            : `Trello gesynchroniseerd: ${summary.synced} kaarten in ${duration}. ${stageSummary}`,
      },
    };
  }

  const visibleFailedNames = failed
    .slice(0, 3)
    .map(({ cardName }) => cardName)
    .join(", ");
  const remainingFailureCount = Math.max(failed.length - 3, 0);
  const failedNames = remainingFailureCount
    ? `${visibleFailedNames} +${remainingFailureCount}`
    : visibleFailedNames;

  return {
    message: "resources.deals.trello_sync.partial",
    type: "warning" as const,
    messageArgs: {
      synced: summary.synced,
      failed_count: failed.length,
      failed_names: failedNames,
      duration,
      stage_summary: stageSummary,
      _: `Trello deels gesynchroniseerd in ${duration}: ${summary.synced} actieve kaarten verwerkt. ${failed.length} mislukt (${failedNames}). ${stageSummary}`,
    },
  };
};
