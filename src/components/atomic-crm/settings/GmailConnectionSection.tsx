import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Link2Off, RefreshCw, Tag } from "lucide-react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GMAIL_CONNECTION_QUERY_KEY,
  useGmailConnection,
} from "../misc/useGmailConnection";
import type { CrmDataProvider } from "../providers/types";

export const GmailConnectionSection = () => {
  const translate = useTranslate();
  return (
    <Card>
      <CardContent>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">
            {translate("crm.profile.gmail.title")}
          </h2>
          <GmailConnectionContent />
        </div>
      </CardContent>
    </Card>
  );
};

export const GmailConnectionContent = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const { data: connection, isPending } = useGmailConnection();
  const {
    data: labels = [],
    error: labelsError,
    isPending: labelsPending,
  } = useQuery({
    queryKey: ["gmail_connection", "labels"],
    queryFn: () => dataProvider.getGmailLabels(),
    enabled: Boolean(connection),
    staleTime: 60_000,
  });

  useEffect(() => {
    setSelectedLabelId(connection?.syncLabelId ?? "");
  }, [connection?.syncLabelId]);

  useEffect(() => {
    const [route, query = ""] = window.location.hash.split("?");
    const params = new URLSearchParams(query);
    const oauthResult = params.get("gmail");
    if (!oauthResult) return;

    if (oauthResult === "connected") {
      notify("crm.profile.gmail.connect_success", { type: "success" });
      queryClient.invalidateQueries({ queryKey: GMAIL_CONNECTION_QUERY_KEY });
    } else {
      notify("crm.profile.gmail.oauth_error", { type: "error" });
    }

    params.delete("gmail");
    const cleanHash = `${route}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${cleanHash}`,
    );
  }, [notify, queryClient]);

  const refreshConnection = () =>
    queryClient.invalidateQueries({ queryKey: GMAIL_CONNECTION_QUERY_KEY });

  const { mutate: connect, isPending: connecting } = useMutation({
    mutationKey: ["gmail_connection", "connect"],
    mutationFn: () => dataProvider.connectGmail(),
    onSuccess: ({ authorizationUrl }) =>
      window.location.assign(authorizationUrl),
    onError: (error) => notify(error.message, { type: "error" }),
  });

  const { mutate: sync, isPending: syncing } = useMutation({
    mutationKey: ["gmail_connection", "sync"],
    mutationFn: () => dataProvider.syncGmail(),
    onSuccess: (summary) => {
      refreshConnection();
      notify("crm.profile.gmail.sync_success", {
        type: "success",
        messageArgs: { count: summary.processed },
      });
    },
    onError: (error) => {
      refreshConnection();
      notify(error.message, { type: "error" });
    },
  });

  const { mutate: setSyncLabel, isPending: settingSyncLabel } = useMutation({
    mutationKey: ["gmail_connection", "sync_label"],
    mutationFn: () => dataProvider.setGmailSyncLabel(selectedLabelId),
    onSuccess: (label) => {
      refreshConnection();
      notify("crm.profile.gmail.sync_label_success", {
        type: "success",
        messageArgs: { label: label.labelName },
      });
    },
    onError: (error) => notify(error.message, { type: "error" }),
  });

  const { mutate: disconnect, isPending: disconnecting } = useMutation({
    mutationKey: ["gmail_connection", "disconnect"],
    mutationFn: () => dataProvider.disconnectGmail(),
    onSuccess: () => {
      setConfirmingDisconnect(false);
      refreshConnection();
      notify("crm.profile.gmail.disconnect_success", { type: "success" });
    },
    onError: (error) => notify(error.message, { type: "error" }),
  });

  if (isPending) return null;

  if (!connection) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {translate("crm.profile.gmail.description")}
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={connecting}
            onClick={() => connect()}
          >
            <Link2 />
            {connecting
              ? translate("crm.profile.gmail.connecting")
              : translate("crm.profile.gmail.connect")}
          </Button>
        </div>
      </div>
    );
  }

  const lastSync = connection.lastSyncedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(connection.lastSyncedAt))
    : translate("crm.profile.gmail.not_synced");

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm">
        <p>
          {translate("crm.profile.gmail.connected", {
            email: connection.email,
          })}
        </p>
        <p className="text-muted-foreground">
          {translate("crm.profile.gmail.last_sync", { date: lastSync })}
        </p>
        {connection.syncLabelName ? (
          <p className="text-muted-foreground">
            {translate("crm.profile.gmail.sync_label_active", {
              label: connection.syncLabelName,
            })}
          </p>
        ) : (
          <p className="text-amber-700 dark:text-amber-400">
            {translate("crm.profile.gmail.sync_label_required")}
          </p>
        )}
        {connection.status === "error" && connection.lastError ? (
          <p className="text-destructive">
            {translate("crm.profile.gmail.sync_error", {
              error: connection.lastError,
            })}
          </p>
        ) : null}
      </div>
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="size-4" />
          <label htmlFor="gmail-sync-label">
            {translate("crm.profile.gmail.sync_label")}
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {translate("crm.profile.gmail.sync_label_description")}
        </p>
        {labelsError ? (
          <p className="text-sm text-destructive">{labelsError.message}</p>
        ) : labels.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selectedLabelId || undefined}
              onValueChange={setSelectedLabelId}
              disabled={labelsPending || settingSyncLabel}
            >
              <SelectTrigger id="gmail-sync-label" className="w-full">
                <SelectValue
                  placeholder={translate(
                    "crm.profile.gmail.sync_label_placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={label.id}>
                    {label.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={
                !selectedLabelId ||
                selectedLabelId === connection.syncLabelId ||
                settingSyncLabel
              }
              onClick={() => setSyncLabel()}
            >
              {settingSyncLabel
                ? translate("crm.profile.gmail.sync_label_saving")
                : translate("crm.profile.gmail.sync_label_save")}
            </Button>
          </div>
        ) : labelsPending ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.profile.gmail.sync_label_loading")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.profile.gmail.sync_label_empty")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {translate("crm.profile.gmail.sync_label_hint")}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={
            syncing ||
            connection.status === "syncing" ||
            !connection.syncLabelId
          }
          onClick={() => sync()}
        >
          <RefreshCw className={syncing ? "animate-spin" : undefined} />
          {syncing
            ? translate("crm.profile.gmail.syncing")
            : translate("crm.profile.gmail.sync")}
        </Button>
        {confirmingDisconnect ? (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={disconnecting}
              onClick={() => setConfirmingDisconnect(false)}
            >
              {translate("ra.action.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disconnecting}
              onClick={() => disconnect()}
            >
              <Link2Off />
              {translate("crm.profile.gmail.disconnect_confirm")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingDisconnect(true)}
          >
            <Link2Off />
            {translate("crm.profile.gmail.disconnect")}
          </Button>
        )}
      </div>
    </div>
  );
};
