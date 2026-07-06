import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Link2Off } from "lucide-react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  MONEYBIRD_CONNECTION_QUERY_KEY,
  useMoneybirdConnection,
} from "../misc/useMoneybirdConnection";
import type { CrmDataProvider } from "../providers/types";

type AdministrationOption = { id: string; name: string };

// Profile section to link the current user's OWN Moneybird administration via
// a personal API token. The token is sent straight to the moneybird_connection
// edge function (which validates it live and stores it encrypted); it is never
// kept in any client-side state beyond this controlled input.
export const MoneybirdConnectionSection = () => {
  const translate = useTranslate();
  return (
    <Card>
      <CardContent>
        <div className="space-y-4 justify-between">
          <h2 className="text-xl font-semibold text-muted-foreground">
            {translate("crm.profile.moneybird.title")}
          </h2>
          <MoneybirdConnectionContent />
        </div>
      </CardContent>
    </Card>
  );
};

// The bare connect/disconnect UI, reused by the desktop profile Card above and
// the mobile settings page (which brings its own section label and framing).
export const MoneybirdConnectionContent = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  const { data: connection, isPending: statusLoading } =
    useMoneybirdConnection();

  const [apiToken, setApiToken] = useState("");
  const [administrationId, setAdministrationId] = useState<string>("");
  // Filled from the edge function's 409 response when the token can access
  // several administrations; the user then picks one and connects again.
  const [administrations, setAdministrations] = useState<
    AdministrationOption[]
  >([]);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const invalidateConnection = () => {
    queryClient.invalidateQueries({ queryKey: MONEYBIRD_CONNECTION_QUERY_KEY });
    // Tax rates are per administration; after a connect/disconnect the cached
    // rates of the previous administration must never be reused.
    queryClient.invalidateQueries({ queryKey: ["moneybird_tax_rates"] });
  };

  const { mutate: connect, isPending: connecting } = useMutation({
    mutationKey: ["moneybird_connection", "connect"],
    mutationFn: () =>
      dataProvider.connectMoneybird({
        apiToken,
        administrationId: administrationId || undefined,
      }),
    onSuccess: (result) => {
      setApiToken("");
      setAdministrationId("");
      setAdministrations([]);
      invalidateConnection();
      notify("crm.profile.moneybird.connect_success", {
        type: "success",
        messageArgs: { administration: result.administrationName },
      });
    },
    onError: (error) => {
      const withList = error as Error & {
        administrations?: AdministrationOption[];
      };
      if (withList.administrations?.length) {
        setAdministrations(withList.administrations);
        return;
      }
      notify(error.message, { type: "error" });
    },
  });

  const canConnect =
    !connecting &&
    Boolean(apiToken.trim()) &&
    (administrations.length === 0 || Boolean(administrationId));

  const { mutate: disconnect, isPending: disconnecting } = useMutation({
    mutationKey: ["moneybird_connection", "disconnect"],
    mutationFn: () => dataProvider.disconnectMoneybird(),
    onSuccess: () => {
      setConfirmingDisconnect(false);
      invalidateConnection();
      notify("crm.profile.moneybird.disconnect_success", { type: "success" });
    },
    onError: (error) => {
      setConfirmingDisconnect(false);
      notify(error.message, { type: "error" });
    },
  });

  return (
    <div className="space-y-4">
      {statusLoading ? null : connection ? (
        <>
          <p className="text-sm text-muted-foreground">
            {translate("crm.profile.moneybird.connected", {
              administration:
                connection.administrationName || connection.administrationId,
            })}
          </p>
          <div className="flex flex-row justify-end gap-2">
            {confirmingDisconnect ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDisconnect(false)}
                  disabled={disconnecting}
                >
                  {translate("ra.action.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => disconnect()}
                  disabled={disconnecting}
                >
                  <Link2Off />
                  {translate("crm.profile.moneybird.disconnect_confirm")}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingDisconnect(true)}
              >
                <Link2Off />
                {translate("crm.profile.moneybird.disconnect")}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {translate("crm.profile.moneybird.description")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="moneybird-api-token">
              {translate("crm.profile.moneybird.token_label")}
            </Label>
            <Input
              id="moneybird-api-token"
              type="password"
              autoComplete="off"
              value={apiToken}
              onChange={(event) => {
                setApiToken(event.target.value);
                // A different token has its own administration list.
                setAdministrations([]);
                setAdministrationId("");
              }}
              onKeyDown={(event) => {
                // On the profile page this section lives inside the profile
                // <Form>; Enter must connect Moneybird, not submit that form.
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (canConnect) connect();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {translate("crm.profile.moneybird.token_help")}
            </p>
          </div>

          {administrations.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="moneybird-administration">
                {translate("crm.profile.moneybird.administration_label")}
              </Label>
              <Select
                value={administrationId || undefined}
                onValueChange={setAdministrationId}
              >
                <SelectTrigger id="moneybird-administration" className="w-full">
                  <SelectValue
                    placeholder={translate(
                      "crm.profile.moneybird.administration_placeholder",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {administrations.map((administration) => (
                    <SelectItem
                      key={administration.id}
                      value={administration.id}
                    >
                      {administration.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => connect()}
              disabled={!canConnect}
            >
              <Link2 />
              {connecting
                ? translate("crm.profile.moneybird.connecting")
                : translate("crm.profile.moneybird.connect")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
