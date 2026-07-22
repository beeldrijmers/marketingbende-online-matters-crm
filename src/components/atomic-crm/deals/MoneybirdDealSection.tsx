import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useMoneybirdConnection } from "../misc/useMoneybirdConnection";
import type { CrmDataProvider } from "../providers/types";
import type {
  Deal,
  MoneybirdDealStatus,
  MoneybirdDocumentCandidate,
  MoneybirdDocumentCheck,
} from "../types";
import { MoneybirdDocumentControl } from "./MoneybirdDocumentButtons";

const formatAmount = (amount: number, currency: string): string =>
  amount.toLocaleString("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const MONEYBIRD_STATE_LABELS: Record<string, string> = {
  draft: "Concept",
  open: "Openstaand",
  scheduled: "Ingepland",
  pending_payment: "Betaling onderweg",
  late: "Te laat",
  paid: "Betaald",
  reminded: "Herinnering verstuurd",
  uncollectible: "Oninbaar",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  billed: "Gefactureerd",
  archived: "Gearchiveerd",
  unknown: "Onbekend",
  onbekend: "Onbekend",
};

const stateLabel = (state?: string | null): string =>
  state ? MONEYBIRD_STATE_LABELS[state] || state : "Aanwezig";

const withLiveStatus = (record: Deal, status?: MoneybirdDealStatus): Deal => ({
  ...record,
  moneybird_estimate_id:
    status?.estimate.linked && status.estimate.document?.id
      ? status.estimate.document.id
      : record.moneybird_estimate_id,
  moneybird_estimate_live_state:
    status?.estimate.document?.state ?? record.moneybird_estimate_live_state,
  moneybird_estimate_checked_at:
    status?.estimate.checkedAt ?? record.moneybird_estimate_checked_at,
  moneybird_estimate_administration_id:
    status?.estimate.administrationId ??
    record.moneybird_estimate_administration_id,
  moneybird_invoice_id:
    status?.invoice.linked && status.invoice.document?.id
      ? status.invoice.document.id
      : record.moneybird_invoice_id,
  moneybird_invoice_live_state:
    status?.invoice.document?.state ?? record.moneybird_invoice_live_state,
  moneybird_invoice_checked_at:
    status?.invoice.checkedAt ?? record.moneybird_invoice_checked_at,
  moneybird_invoice_administration_id:
    status?.invoice.administrationId ??
    record.moneybird_invoice_administration_id,
});

const DocumentStatusBadge = ({
  icon,
  label,
  check,
  creationStatus,
}: {
  icon: ReactNode;
  label: string;
  check?: MoneybirdDocumentCheck;
  creationStatus?: Deal["moneybird_estimate_status"];
}) => (
  <Badge
    variant="secondary"
    className={
      check?.linked
        ? "gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "gap-1 text-[10px]"
    }
  >
    {icon}
    {check?.linked
      ? `${label}: ${stateLabel(check.document?.state)}`
      : creationStatus === "pending"
        ? `${label}: aanmaken bezig`
        : creationStatus === "failed"
          ? `${label}: vorige poging mislukt`
          : `Nog geen ${label.toLowerCase()}`}
  </Badge>
);

const Candidate = ({
  candidate,
  kind,
  busy,
  onLink,
}: {
  candidate: MoneybirdDocumentCandidate;
  kind: "estimate" | "invoice";
  busy: boolean;
  onLink: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs">
    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
    <div className="min-w-48 flex-1">
      <div className="font-medium">
        Mogelijke {kind === "estimate" ? "offerte" : "factuur"}:{" "}
        {candidate.description || candidate.id}
      </div>
      <div className="text-muted-foreground">
        {candidate.amountExcludingTax
          ? `€ ${Number(candidate.amountExcludingTax).toLocaleString("nl-NL", { minimumFractionDigits: 2 })} excl. btw · `
          : ""}
        {stateLabel(candidate.state)}
        {candidate.reasons?.length ? ` · ${candidate.reasons.join(", ")}` : ""}
      </div>
    </div>
    <Button type="button" size="sm" disabled={busy} onClick={onLink}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      Koppelen
    </Button>
  </div>
);

export const MoneybirdDealSection = ({ record }: { record: Deal }) => {
  const { currency } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [ignoredCandidates, setIgnoredCandidates] = useState(false);
  const { data: connection, isPending: connectionPending } =
    useMoneybirdConnection();
  const {
    data: liveStatus,
    isPending: statusPending,
    isFetching: statusFetching,
    isError: statusError,
    refetch,
  } = useQuery({
    queryKey: ["moneybird", "deal-status", record.id],
    queryFn: () => dataProvider.getMoneybirdDealStatus(record.id),
    enabled: Boolean(connection),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const effectiveRecord = useMemo(
    () => withLiveStatus(record, liveStatus),
    [liveStatus, record],
  );
  const { mutate: linkCandidate, isPending: linkingCandidate } = useMutation({
    mutationFn: (params: {
      kind: "estimate" | "invoice";
      documentId: string;
    }) =>
      dataProvider.linkMoneybirdCandidate({
        dealId: record.id,
        ...params,
      }),
    onSuccess: (update) => {
      queryClient.setQueryData<MoneybirdDealStatus>(
        ["moneybird", "deal-status", record.id],
        (current) => ({
          estimate: update.estimate ||
            current?.estimate || {
              linked: false,
              checked: true,
              candidates: [],
            },
          invoice: update.invoice ||
            current?.invoice || {
              linked: false,
              checked: true,
              candidates: [],
            },
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      notify("Moneybird-document is aan de opdracht gekoppeld", {
        type: "success",
      });
    },
    onError: (error) =>
      notify(
        error instanceof Error
          ? error.message
          : "Moneybird-document koppelen is mislukt",
        { type: "error" },
      ),
  });
  if (record.is_internal) return null;

  const amountLabel =
    record.amount != null && record.amount > 0
      ? formatAmount(record.amount, currency)
      : null;
  const amountKnown = amountLabel !== null;
  const estimateNeedsReview =
    !ignoredCandidates && (liveStatus?.estimate.candidates.length || 0) > 0;
  const invoiceNeedsReview =
    !ignoredCandidates && (liveStatus?.invoice.candidates.length || 0) > 0;

  return (
    <section
      aria-label="Offerte en facturatie"
      className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <CircleDollarSign className="size-5" />
        </div>

        <div className="min-w-56 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              Moneybird · offerte en facturatie
            </h3>
            <Badge
              variant="outline"
              className={
                amountKnown
                  ? "border-emerald-500/40 text-emerald-600"
                  : "border-amber-500/40 text-amber-600"
              }
            >
              {amountLabel ?? "NTB"}
            </Badge>
          </div>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {amountKnown
              ? "Maak de offerte of factuur rechtstreeks vanuit deze opdracht aan, of open een bestaand document."
              : "Het opdrachtbedrag is nog niet bevestigd. Vul eerst het bedrag in via Bewerken voordat je een document aanmaakt."}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <FileText className="size-3" />
              {connectionPending
                ? "Koppeling controleren…"
                : !connection
                  ? "Moneybird niet gekoppeld"
                  : statusFetching
                    ? "Moneybird controleren…"
                    : statusError
                      ? "Controle mislukt"
                      : liveStatus
                        ? "Live gecontroleerd"
                        : "Nog niet gecontroleerd"}
            </Badge>
            <DocumentStatusBadge
              icon={<FileText className="size-3" />}
              label="Offerte"
              creationStatus={effectiveRecord.moneybird_estimate_status}
              check={
                liveStatus?.estimate.linked
                  ? liveStatus.estimate
                  : effectiveRecord.moneybird_estimate_id
                    ? {
                        linked: true,
                        checked: false,
                        document: {
                          id: effectiveRecord.moneybird_estimate_id,
                          state:
                            effectiveRecord.moneybird_estimate_live_state ||
                            "onbekend",
                        },
                        candidates: [],
                      }
                    : liveStatus?.estimate
              }
            />
            <DocumentStatusBadge
              icon={<Receipt className="size-3" />}
              label="Factuur"
              creationStatus={effectiveRecord.moneybird_invoice_status}
              check={
                liveStatus?.invoice.linked
                  ? liveStatus.invoice
                  : effectiveRecord.moneybird_invoice_id
                    ? {
                        linked: true,
                        checked: false,
                        document: {
                          id: effectiveRecord.moneybird_invoice_id,
                          state:
                            effectiveRecord.moneybird_invoice_live_state ||
                            "onbekend",
                        },
                        candidates: [],
                      }
                    : liveStatus?.invoice
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {connectionPending || (connection && statusPending) ? (
            <Button type="button" variant="outline" disabled>
              <Loader2 className="size-4 animate-spin" /> Moneybird controleren
            </Button>
          ) : statusError && connection ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
              >
                <RefreshCw className="size-4" /> Opnieuw controleren
              </Button>
              {effectiveRecord.moneybird_estimate_id ? (
                <MoneybirdDocumentControl
                  record={effectiveRecord}
                  kind="estimate"
                />
              ) : null}
              {effectiveRecord.moneybird_invoice_id ? (
                <MoneybirdDocumentControl
                  record={effectiveRecord}
                  kind="invoice"
                />
              ) : null}
            </>
          ) : (
            <>
              {!estimateNeedsReview ? (
                <MoneybirdDocumentControl
                  record={effectiveRecord}
                  kind="estimate"
                />
              ) : null}
              {!invoiceNeedsReview ? (
                <MoneybirdDocumentControl
                  record={effectiveRecord}
                  kind="invoice"
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {statusError && connection ? (
        <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
          De live Moneybird-controle is niet gelukt. Uit veiligheid maken we pas
          een nieuw document aan nadat de controle slaagt.
        </div>
      ) : null}

      {!ignoredCandidates && liveStatus ? (
        <div className="mt-3 space-y-2">
          {liveStatus.estimate.candidates.map((candidate) => (
            <Candidate
              key={`estimate-${candidate.id}`}
              candidate={candidate}
              kind="estimate"
              busy={linkingCandidate}
              onLink={() =>
                linkCandidate({ kind: "estimate", documentId: candidate.id })
              }
            />
          ))}
          {liveStatus.invoice.candidates.map((candidate) => (
            <Candidate
              key={`invoice-${candidate.id}`}
              candidate={candidate}
              kind="invoice"
              busy={linkingCandidate}
              onLink={() =>
                linkCandidate({ kind: "invoice", documentId: candidate.id })
              }
            />
          ))}
          {liveStatus.estimate.candidates.length > 0 ||
          liveStatus.invoice.candidates.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIgnoredCandidates(true)}
            >
              Geen van deze documenten hoort bij de opdracht
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
