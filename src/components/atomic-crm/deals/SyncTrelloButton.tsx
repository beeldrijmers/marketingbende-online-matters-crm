import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CrmDataProvider } from "../providers/types";
import { getTrelloSyncNotification } from "./trelloSyncNotification";

// Top-right button on the deals board that pulls every Trello card into the
// CRM on demand. The sync is idempotent, so re-clicking is always safe.
export const SyncTrelloButton = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { mutate, isPending } = useMutation({
    mutationKey: ["trello-sync", "sync_all"],
    mutationFn: () => dataProvider.syncTrelloCards(),
    onSuccess: async (summary) => {
      const stageCounts = summary.stageCounts;
      const localizedStageSummary = stageCounts
        ? translate("resources.deals.trello_sync.stage_summary", {
            new_count: stageCounts["informatie-pipeline"],
            active_count: stageCounts.bezig,
            hold_count: stageCounts["on-hold"],
            live_count: stageCounts["facturatie-live"],
            won_count: stageCounts.won,
            _: `Nieuw ${stageCounts["informatie-pipeline"]} · Bezig ${stageCounts.bezig} · In de wacht ${stageCounts["on-hold"]} · Facturatie & live ${stageCounts["facturatie-live"]} · Klaar ${stageCounts.won}`,
          })
        : undefined;
      const notification = getTrelloSyncNotification(
        summary,
        localizedStageSummary,
      );
      notify(notification.message, {
        type: notification.type,
        messageArgs: notification.messageArgs,
      });
      await Promise.all(
        ["deals", "tasks", "companies", "contacts", "deal_notes"].map(
          (resource) => queryClient.invalidateQueries({ queryKey: [resource] }),
        ),
      );
      refresh();
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : translate("resources.deals.trello_sync.error", {
              _: "Synchroniseren met Trello is mislukt",
            }),
        { type: "error" },
      );
    },
  });

  useEffect(() => {
    if (!isPending) return;
    const startedAt = Date.now();
    const updateElapsed = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [isPending]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setElapsedSeconds(0);
        mutate();
      }}
      disabled={isPending}
    >
      <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending
        ? `${translate("resources.deals.trello_sync.pending", {
            _: "Synchroniseren...",
          })} ${elapsedSeconds}s`
        : translate("resources.deals.trello_sync.action", {
            _: "Synchroniseer Trello",
          })}
    </Button>
  );
};
