import type { CrmDataProvider } from "../providers/types";

type TrelloSyncSummary = Awaited<
  ReturnType<CrmDataProvider["syncTrelloCards"]>
>;

export const getTrelloSyncNotification = (summary: TrelloSyncSummary) => {
  const failed = summary.failed ?? [];

  if (failed.length === 0) {
    return {
      message: "resources.deals.trello_sync.success",
      type: "success" as const,
      messageArgs: {
        smart_count: summary.synced,
        _:
          summary.synced === 1
            ? "Trello gesynchroniseerd: 1 kaart verwerkt."
            : `Trello gesynchroniseerd: ${summary.synced} kaarten verwerkt.`,
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
      _: `Trello deels gesynchroniseerd: ${summary.synced} actieve kaarten verwerkt. ${failed.length} mislukt (${failedNames}).`,
    },
  };
};
