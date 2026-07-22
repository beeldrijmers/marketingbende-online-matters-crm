import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  ExternalLink,
  FileText,
  Receipt,
} from "lucide-react";
import {
  useGetOne,
  useNotify,
  useRefresh,
  useTranslate,
  useDataProvider,
} from "ra-core";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { useMoneybirdConnection } from "../misc/useMoneybirdConnection";
import type { CrmDataProvider } from "../providers/types";
import type { Company, Deal } from "../types";

// The 21% btw rate is pre-selected by default (still overridable).
const DEFAULT_TAX_PERCENTAGE = "21.0";

type DocumentKind = "estimate" | "invoice";

const statusOf = (record: Deal, kind: DocumentKind) =>
  kind === "estimate"
    ? record.moneybird_estimate_status
    : record.moneybird_invoice_status;

const idOf = (record: Deal, kind: DocumentKind) =>
  kind === "estimate"
    ? record.moneybird_estimate_id
    : record.moneybird_invoice_id;

const iconFor = (kind: DocumentKind) =>
  kind === "estimate" ? Receipt : FileText;

const formatAmount = (amount: number, currency: string) =>
  amount.toLocaleString("nl-NL", { style: "currency", currency });

const MoneybirdDocumentButton = ({
  compact = false,
  record,
  kind,
}: {
  compact?: boolean;
  record: Deal;
  kind: DocumentKind;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const isPending = statusOf(record, kind) === "pending";
  const Icon = iconFor(kind);

  // Documents are created in the CALLER'S OWN Moneybird administration, so the
  // create dialog only works for users who linked one. Without a connection the
  // button stays clickable but explains itself via a notification (works for
  // keyboard, touch and screen readers alike, unlike a hover-only hint on a
  // disabled button). When the status query itself errors we let the click
  // through: the edge function is the source of truth and answers with its own
  // clear message.
  const { data: connection, isPending: connectionLoading } =
    useMoneybirdConnection();
  const notConnected = !connectionLoading && connection === null;
  const notConnectedHint = translate(
    "resources.deals.moneybird.not_connected_hint",
  );

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (notConnected) {
      notify(notConnectedHint, { type: "warning" });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        size="sm"
        variant="outline"
        className={cn(
          "flex items-center gap-2",
          compact ? "h-7 px-2 text-[11px]" : "h-9",
          notConnected && "opacity-60",
        )}
        disabled={isPending || connectionLoading}
        title={notConnected ? notConnectedHint : undefined}
        aria-label={translate(`resources.deals.moneybird.${kind}.action`)}
      >
        <Icon className={compact ? "size-3.5" : "size-4"} />
        {isPending
          ? translate(
              `resources.deals.moneybird.${kind}.${compact ? "card_pending" : "pending"}`,
            )
          : translate(
              `resources.deals.moneybird.${kind}.${compact ? "card_action" : "action"}`,
            )}
      </Button>
      {open ? (
        <MoneybirdDocumentDialog
          record={record}
          kind={kind}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
};

const MoneybirdDocumentDialog = ({
  record,
  kind,
  open,
  onClose,
}: {
  record: Deal;
  kind: DocumentKind;
  open: boolean;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { currency } = useConfigurationContext();

  // Trello-backed descriptions contain internal context (and can include
  // operational notes). A customer-facing document therefore starts with the
  // concise assignment name; the user can deliberately expand it here.
  const [description, setDescription] = useState(record.name || "");
  const [taxRateId, setTaxRateId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id },
    { enabled: Boolean(record.company_id) },
  );

  // Tax rates differ PER administration, so the cache key includes the
  // administration of the caller's own connection: switching connections never
  // serves the previous administration's rates from cache.
  const { data: connection } = useMoneybirdConnection();
  const {
    data: taxRates,
    isPending: taxRatesLoading,
    isError: taxRatesError,
    refetch: refetchTaxRates,
  } = useQuery({
    queryKey: ["moneybird_tax_rates", connection?.administrationId],
    queryFn: () => dataProvider.getMoneybirdTaxRates(),
    enabled: open && Boolean(connection),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!taxRateId && taxRates?.length) {
      const preferred =
        taxRates.find((rate) => rate.percentage === DEFAULT_TAX_PERCENTAGE) ??
        taxRates[0];
      setTaxRateId(preferred.id);
    }
  }, [taxRates, taxRateId]);

  const missingCompany = !record.company_id;
  const missingAmount = !record.amount || record.amount <= 0;
  const wrongCurrency = currency !== "EUR";
  const blocked = missingCompany || missingAmount || wrongCurrency;

  const contactCount = record.contact_ids?.length ?? 0;
  const queryClient = useQueryClient();

  const { mutateAsync } = useMutation({
    mutationKey: ["deals", "moneybird", kind, record.id],
    mutationFn: () =>
      dataProvider.createMoneybirdDocument(kind, {
        dealId: record.id,
        taxRateId,
        description,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({
          queryKey: ["moneybird", "deal-status", record.id],
        }),
      ]),
  });

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      await mutateAsync();
      notify(`resources.deals.moneybird.${kind}.success`, { type: "success" });
      refresh();
      onClose();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : translate(`resources.deals.moneybird.${kind}.error`),
        { type: "error" },
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 md:min-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>
            {translate(`resources.deals.moneybird.${kind}.dialog_title`)}
          </DialogTitle>
          <DialogDescription>
            {translate(`resources.deals.moneybird.${kind}.dialog_description`)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {missingCompany ? (
            <Alert variant="destructive">
              <AlertDescription>
                {translate("resources.deals.moneybird.no_company")}
              </AlertDescription>
            </Alert>
          ) : null}
          {missingAmount ? (
            <Alert variant="destructive">
              <AlertDescription>
                {translate("resources.deals.moneybird.no_amount")}
              </AlertDescription>
            </Alert>
          ) : null}
          {wrongCurrency ? (
            <Alert variant="destructive">
              <AlertDescription>
                {translate("resources.deals.moneybird.wrong_currency")}
              </AlertDescription>
            </Alert>
          ) : null}

          {!blocked ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.moneybird.company")}
                </span>
                <span className="text-sm font-medium">{company?.name}</span>
                <span className="text-sm text-muted-foreground">
                  {company?.address
                    ? [company.address, company.zipcode, company.city]
                        .filter(Boolean)
                        .join(", ")
                    : translate("resources.deals.moneybird.no_address")}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.moneybird.amount")}
                </span>
                <span className="text-sm font-medium">
                  {formatAmount(record.amount ?? 0, currency)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="moneybird-description">
                  {translate("resources.deals.moneybird.description_label")}
                </Label>
                <Textarea
                  id="moneybird-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 max-h-48 resize-y field-sizing-fixed"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {translate("resources.deals.moneybird.description_helper")}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="moneybird-tax-rate">
                  {translate("resources.deals.moneybird.tax_rate")}
                </Label>
                <Select
                  value={taxRateId || undefined}
                  onValueChange={setTaxRateId}
                  disabled={taxRatesLoading}
                >
                  <SelectTrigger id="moneybird-tax-rate" className="w-full">
                    <SelectValue
                      placeholder={translate(
                        taxRatesLoading
                          ? "resources.deals.moneybird.tax_rate_loading"
                          : "resources.deals.moneybird.tax_rate_placeholder",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {taxRates?.map((rate) => (
                      <SelectItem key={rate.id} value={rate.id}>
                        {rate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {taxRatesError ? (
                  <Alert variant="destructive">
                    <AlertDescription className="flex flex-col gap-2">
                      {translate("resources.deals.moneybird.tax_rate_error")}
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => refetchTaxRates()}
                      >
                        {translate("resources.deals.moneybird.tax_rate_retry")}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              {contactCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {translate("resources.deals.moneybird.no_contact_hint")}
                </p>
              ) : null}
              {contactCount > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    "resources.deals.moneybird.multiple_contacts_hint",
                  )}
                </p>
              ) : null}

              <Alert>
                <AlertTitle>
                  {translate("resources.deals.moneybird.warning_title")}
                </AlertTitle>
                <AlertDescription>
                  {translate(`resources.deals.moneybird.${kind}.warning`)}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            {translate("ra.action.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={blocked || isCreating || !taxRateId}
          >
            {(() => {
              const Icon = iconFor(kind);
              return <Icon className="w-4 h-4" />;
            })()}
            {isCreating
              ? translate("resources.deals.moneybird.creating")
              : translate(`resources.deals.moneybird.${kind}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ViewMoneybirdDocumentButton = ({
  compact = false,
  record,
  kind,
}: {
  compact?: boolean;
  record: Deal;
  kind: DocumentKind;
}) => {
  const translate = useTranslate();
  const documentId = idOf(record, kind);

  // Documents live in the administration of whoever created them (connections
  // are per user), so the deep link is built from the administration id stored
  // on the deal. The id is not a secret; it appears in Moneybird URLs.
  const administrationId =
    kind === "estimate"
      ? record.moneybird_estimate_administration_id
      : record.moneybird_invoice_administration_id;

  const href = useMemo(() => {
    const path = kind === "estimate" ? "estimates" : "sales_invoices";
    if (administrationId && documentId) {
      return `https://moneybird.com/${administrationId}/${path}/${documentId}`;
    }
    return "https://moneybird.com";
  }, [administrationId, documentId, kind]);

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(
        "flex items-center gap-2",
        compact ? "h-7 px-2 text-[11px]" : "h-9",
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={translate(`resources.deals.moneybird.${kind}.view`)}
      >
        <ExternalLink className={compact ? "size-3.5" : "size-4"} />
        {translate(
          `resources.deals.moneybird.${kind}.${compact ? "card_view" : "view"}`,
        )}
      </a>
    </Button>
  );
};

// Renders the create-or-view control for one document kind on a deal.
export const MoneybirdDocumentControl = ({
  compact = false,
  record,
  kind,
}: {
  compact?: boolean;
  record: Deal;
  kind: DocumentKind;
}) =>
  idOf(record, kind) ? (
    <ViewMoneybirdDocumentButton
      compact={compact}
      record={record}
      kind={kind}
    />
  ) : (
    <MoneybirdDocumentButton compact={compact} record={record} kind={kind} />
  );

// A compact, drag-safe financial toolbar for the Kanban card itself. The full
// details dialog remains available, but creating or opening a document no
// longer requires opening the assignment first.
export const MoneybirdCardActions = ({ record }: { record: Deal }) => {
  if (record.is_internal) return null;

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-1 border-t pt-1.5"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="mr-auto flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <CircleDollarSign className="size-3.5" />
        Moneybird
      </span>
      <MoneybirdDocumentControl compact record={record} kind="estimate" />
      <MoneybirdDocumentControl compact record={record} kind="invoice" />
    </div>
  );
};
