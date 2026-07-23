import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  InzyteBootstrap,
  InzyteIntegration,
  InzyteLink,
  InzyteWorkspace,
} from "../../types";
import { findNamedArray } from "./inzyteData";
import { getInzyteConnectionSummary } from "./inzyteVerification";

type JsonRecord = Record<string, unknown>;
type GoogleProvider =
  | "ga4"
  | "search_console"
  | "business_profile"
  | "google_ads";

export type InzyteLinkDraft = {
  websiteUrl: string;
  inzyteUserId: string;
  ga4ConnectionId: string;
  ga4ConnectionName: string;
  ga4PropertyId: string;
  ga4PropertyName: string;
  gscSiteUrl: string;
  gbpAccountId: string;
  gbpLocationId: string;
  gbpLocationName: string;
  adsCustomerId: string;
  adsAccountName: string;
  adsLoginCustomerId: string;
};

const getText = (row: JsonRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return "";
};

const getSourceOptions = (
  rows: JsonRecord[],
  idKeys: string[],
  nameKeys: string[],
): Array<{ id: string; name: string }> => {
  const seen = new Set<string>();
  const options: Array<{ id: string; name: string }> = [];
  for (const row of rows) {
    const id = getText(row, idKeys);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    options.push({ id, name: getText(row, nameKeys) || id });
  }
  return options;
};

const fromLink = (
  link: InzyteLink | null,
  fallbackWebsite: string | null,
): InzyteLinkDraft => ({
  websiteUrl: link?.website_url || fallbackWebsite || "",
  inzyteUserId: link?.inzyte_user_id || "",
  ga4ConnectionId: link?.ga4_connection_id || "",
  ga4ConnectionName: link?.ga4_connection_name || "",
  ga4PropertyId: link?.ga4_property_id || "",
  ga4PropertyName: link?.ga4_property_name || "",
  gscSiteUrl: link?.gsc_site_url || "",
  gbpAccountId: link?.gbp_account_id || "",
  gbpLocationId: link?.gbp_location_id || "",
  gbpLocationName: link?.gbp_location_name || "",
  adsCustomerId: link?.ads_customer_id || "",
  adsAccountName: link?.ads_account_name || "",
  adsLoginCustomerId: link?.ads_login_customer_id || "",
});

const providerState = (
  workspace: InzyteWorkspace | undefined,
  provider: string,
): {
  connected: boolean;
  needsReauth: boolean;
  integration?: InzyteIntegration;
} => {
  const integration = workspace?.integrations.find(
    (item) => item.provider === provider && item.active,
  );
  return {
    connected: Boolean(integration),
    needsReauth: integration?.settings.needsReauth === true,
    integration,
  };
};

const SourceSelect = ({
  id,
  label,
  value,
  rows,
  idKeys,
  nameKeys,
  placeholder,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  rows: JsonRecord[];
  idKeys: string[];
  nameKeys: string[];
  placeholder: string;
  onSelect: (id: string, row?: JsonRecord) => void;
}) => {
  const options = getSourceOptions(rows, idKeys, nameKeys);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const selected = rows.find(
            (row) => getText(row, idKeys) === event.target.value,
          );
          onSelect(event.target.value, selected);
        }}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};

const ProviderCard = ({
  title,
  description,
  state,
  provider,
  busy,
  onOauth,
}: {
  title: string;
  description: string;
  state: ReturnType<typeof providerState>;
  provider: GoogleProvider;
  busy: boolean;
  onOauth: (provider: GoogleProvider) => void;
}) => (
  <div className="flex min-h-32 flex-col rounded-xl border bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <Badge
        variant="outline"
        className={
          state.needsReauth
            ? "border-amber-500/40 text-amber-600"
            : state.connected
              ? "border-emerald-500/40 text-emerald-600"
              : ""
        }
      >
        {state.needsReauth
          ? "Opnieuw koppelen"
          : state.connected
            ? "Google-account actief"
            : "Geen Google-account"}
      </Badge>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-auto self-start"
      disabled={busy}
      onClick={() => onOauth(provider)}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ExternalLink className="size-4" />
      )}
      {state.connected ? "Opnieuw autoriseren" : "Google koppelen"}
    </Button>
  </div>
);

export const InzyteConnections = ({
  bootstrap,
  sources,
  busy,
  onLoadSources,
  onOauth,
  onSave,
  onUnlink,
}: {
  bootstrap: InzyteBootstrap;
  sources: unknown;
  busy: string | null;
  onLoadSources: (draft: InzyteLinkDraft) => Promise<void>;
  onOauth: (provider: GoogleProvider, draft: InzyteLinkDraft) => Promise<void>;
  onSave: (draft: InzyteLinkDraft) => Promise<void>;
  onUnlink: () => Promise<void>;
}) => {
  const initialLink = bootstrap.link || bootstrap.suggestedLink;
  const connectionSummary = getInzyteConnectionSummary(bootstrap.link);
  const [draft, setDraft] = useState<InzyteLinkDraft>(() =>
    fromLink(initialLink, bootstrap.deal.companyWebsite),
  );
  const workspace = bootstrap.workspaces.find(
    (item) => item.id === draft.inzyteUserId,
  );
  const ga4Connections =
    workspace?.integrations.filter(
      (item) => item.provider === "google_ga4" && item.active,
    ) || [];

  const sourceRecord = (sources || {}) as JsonRecord;
  const propertyRows = useMemo(
    () => findNamedArray(sourceRecord.properties, ["properties", "items"]),
    [sourceRecord.properties],
  );
  const scRows = useMemo(
    () => findNamedArray(sourceRecord.searchConsole, ["sites", "items"]),
    [sourceRecord.searchConsole],
  );
  const gbpRows = useMemo(
    () => findNamedArray(sourceRecord.businessProfile, ["locations", "items"]),
    [sourceRecord.businessProfile],
  );
  const adsRows = useMemo(
    () => findNamedArray(sourceRecord.googleAds, ["accounts", "items"]),
    [sourceRecord.googleAds],
  );

  const update = (values: Partial<InzyteLinkDraft>) =>
    setDraft((current) => ({ ...current, ...values }));

  return (
    <div className="space-y-6 pb-10">
      {bootstrap.suggestedLink && !bootstrap.link ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <Link2 className="size-5 text-sky-600" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              Koppeling van dezelfde klant gevonden
            </div>
            <div className="text-sm text-muted-foreground">
              We hebben de bestaande klantinstellingen alvast ingevuld.
              Controleer ze voor deze opdracht.
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              Klant en Inzyte-werkruimte
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Kies één klantaccount. Alle analyses vanaf deze kaart blijven aan
              deze opdracht gekoppeld.
            </p>
          </div>
          {connectionSummary.tone === "success" ? (
            <Badge className="gap-1 bg-emerald-600 text-white">
              <ShieldCheck className="size-3.5" /> Meetbronnen gecontroleerd
            </Badge>
          ) : bootstrap.link ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-600"
            >
              Controle nodig
            </Badge>
          ) : (
            <Badge variant="outline">Nog niet opgeslagen</Badge>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="inzyte-workspace">Inzyte-account</Label>
            <select
              id="inzyte-workspace"
              value={draft.inzyteUserId}
              onChange={(event) =>
                update({
                  inzyteUserId: event.target.value,
                  ga4ConnectionId: "",
                  ga4ConnectionName: "",
                  ga4PropertyId: "",
                  ga4PropertyName: "",
                  gscSiteUrl: "",
                  gbpAccountId: "",
                  gbpLocationId: "",
                  gbpLocationName: "",
                  adsCustomerId: "",
                  adsAccountName: "",
                  adsLoginCustomerId: "",
                })
              }
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
            >
              <option value="">Kies een klantaccount…</option>
              {bootstrap.workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inzyte-website">Website</Label>
            <Input
              id="inzyte-website"
              value={draft.websiteUrl}
              placeholder="https://voorbeeld.nl"
              onChange={(event) => update({ websiteUrl: event.target.value })}
            />
          </div>
        </div>
      </section>

      {bootstrap.link && connectionSummary.tone !== "success" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-700 dark:text-amber-400">
          De oude instellingen zijn wel bewaard, maar tellen nog niet als
          actieve klantkoppeling. Haal de beschikbare bronnen live op,
          controleer de klantnaam/property en sla ze daarna opnieuw op.
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Google-koppelingen</h3>
            <p className="text-sm text-muted-foreground">
              Autoriseren gebeurt in een Google-pop-up; je hoeft Inzyte niet te
              openen.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!draft.inzyteUserId || busy !== null}
            onClick={() => onLoadSources(draft)}
          >
            {busy === "sources" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Beschikbare bronnen ophalen
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ProviderCard
            title="Google Analytics 4"
            description="Bezoekers, gedrag, pagina’s, events, conversies en live verkeer."
            state={providerState(workspace, "google_ga4")}
            provider="ga4"
            busy={busy === "oauth:ga4"}
            onOauth={(provider) => onOauth(provider, draft)}
          />
          <ProviderCard
            title="Search Console"
            description="Zoekopdrachten, klikken, vertoningen, CTR en posities."
            state={providerState(workspace, "google_search_console")}
            provider="search_console"
            busy={busy === "oauth:search_console"}
            onOauth={(provider) => onOauth(provider, draft)}
          />
          <ProviderCard
            title="Bedrijfsprofiel"
            description="Lokale zichtbaarheid, acties, reviews en locatieprestaties."
            state={providerState(workspace, "google_business_profile")}
            provider="business_profile"
            busy={busy === "oauth:business_profile"}
            onOauth={(provider) => onOauth(provider, draft)}
          />
          <ProviderCard
            title="Google Ads"
            description="Campagnes, kosten, klikken, conversies, CPA en ROAS."
            state={providerState(workspace, "google_ads")}
            provider="google_ads"
            busy={busy === "oauth:google_ads"}
            onOauth={(provider) => onOauth(provider, draft)}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Bronnen voor deze opdracht</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Deze selectie is opdrachtgebonden. Daardoor kan één bureau-account
          meerdere klanten bedienen. Alleen een bron uit de live opgehaalde
          lijst kan als gecontroleerd worden opgeslagen.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="inzyte-ga4-connection">GA4 Google-account</Label>
            <select
              id="inzyte-ga4-connection"
              value={draft.ga4ConnectionId}
              onChange={(event) => {
                const connection = ga4Connections.find(
                  (item) => item.id === event.target.value,
                );
                update({
                  ga4ConnectionId: event.target.value,
                  ga4ConnectionName:
                    connection?.profile.name || connection?.profile.email || "",
                  ga4PropertyId: "",
                  ga4PropertyName: "",
                });
              }}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
            >
              <option value="">Kies een GA4-koppeling…</option>
              {ga4Connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.profile.name ||
                    connection.profile.email ||
                    connection.id}
                </option>
              ))}
            </select>
          </div>
          <SourceSelect
            id="inzyte-property"
            label="GA4-property"
            value={draft.ga4PropertyId}
            rows={propertyRows}
            idKeys={["propertyId", "property_id", "id"]}
            nameKeys={["displayName", "display_name", "name"]}
            placeholder="Kies een property…"
            onSelect={(id, row) =>
              update({
                ga4PropertyId: id,
                ga4PropertyName: row
                  ? getText(row, ["displayName", "display_name", "name"])
                  : "",
              })
            }
          />
          <SourceSelect
            id="inzyte-gsc-site"
            label="Search Console-site"
            value={draft.gscSiteUrl}
            rows={scRows}
            idKeys={["siteUrl", "site_url", "url"]}
            nameKeys={["siteUrl", "site_url", "url"]}
            placeholder="Kies een website…"
            onSelect={(id) => update({ gscSiteUrl: id })}
          />
          <SourceSelect
            id="inzyte-gbp-location"
            label="Bedrijfsprofiel-locatie"
            value={draft.gbpLocationId}
            rows={gbpRows}
            idKeys={["locationId", "location_id", "name"]}
            nameKeys={["locationName", "location_name", "title", "name"]}
            placeholder="Kies een locatie…"
            onSelect={(id, row) =>
              update({
                gbpLocationId: id,
                gbpLocationName: row
                  ? getText(row, [
                      "locationName",
                      "location_name",
                      "title",
                      "name",
                    ])
                  : "",
                gbpAccountId: row
                  ? getText(row, ["accountId", "account_id", "account"])
                  : "",
              })
            }
          />
          <SourceSelect
            id="inzyte-ads-account"
            label="Google Ads-account"
            value={draft.adsCustomerId}
            rows={adsRows}
            idKeys={["customerId", "customer_id", "id"]}
            nameKeys={[
              "accountName",
              "account_name",
              "descriptiveName",
              "name",
            ]}
            placeholder="Kies een Ads-account…"
            onSelect={(id, row) =>
              update({
                adsCustomerId: id,
                adsAccountName: row
                  ? getText(row, [
                      "accountName",
                      "account_name",
                      "descriptiveName",
                      "name",
                    ])
                  : "",
                adsLoginCustomerId: row
                  ? getText(row, ["loginCustomerId", "login_customer_id"])
                  : "",
              })
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-5">
          <Button
            type="button"
            disabled={!draft.inzyteUserId || busy !== null}
            onClick={() => onSave(draft)}
          >
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Bronnen controleren en opslaan
          </Button>
          {bootstrap.link ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={onUnlink}
            >
              <Unplug className="size-4" /> Loskoppelen
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            OAuth-tokens blijven versleuteld in Inzyte en komen nooit in het
            CRM.
          </span>
        </div>
      </section>
    </div>
  );
};
