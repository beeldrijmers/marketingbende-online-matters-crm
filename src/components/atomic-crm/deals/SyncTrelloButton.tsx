import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";

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

  const { mutate, isPending } = useMutation({
    mutationKey: ["trello-sync", "sync_all"],
    mutationFn: () => dataProvider.syncTrelloCards(),
    onSuccess: (summary) => {
      const notification = getTrelloSyncNotification(summary);
      notify(notification.message, {
        type: notification.type,
        messageArgs: notification.messageArgs,
      });
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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutate()}
      disabled={isPending}
    >
      <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending
        ? translate("resources.deals.trello_sync.pending", {
            _: "Synchroniseren...",
          })
        : translate("resources.deals.trello_sync.action", {
            _: "Synchroniseer Trello",
          })}
    </Button>
  );
};
