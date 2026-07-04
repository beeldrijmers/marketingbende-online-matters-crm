import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Receipt } from "lucide-react";
import {
  useGetOne,
  useNotify,
  useRefresh,
  useTranslate,
  useDataProvider,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";

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

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import type { Company, Deal } from "../types";

// The 21% btw rate is pre-selected by default (still overridable).
const DEFAULT_TAX_PERCENTAGE = "21.0";

const formatAmount = (amount: number, currency: string) =>
  amount.toLocaleString("nl-NL", {
    style: "currency",
    currency,
  });

export const MoneybirdEstimateButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const isPending = record.moneybird_estimate_status === "pending";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
        className="flex items-center gap-2 h-9"
        disabled={isPending}
      >
        <Receipt className="w-4 h-4" />
        {isPending
          ? translate("resources.deals.moneybird.pending")
          : translate("resources.deals.moneybird.action")}
      </Button>
      {open ? (
        <MoneybirdEstimateDialog
          record={record}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
};

const MoneybirdEstimateDialog = ({
  record,
  open,
  onClose,
}: {
  record: Deal;
  open: boolean;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { currency } = useConfigurationContext();

  const [description, setDescription] = useState(
    record.description || record.name || "",
  );
  const [taxRateId, setTaxRateId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id },
    { enabled: Boolean(record.company_id) },
  );

  const { data: taxRates, isPending: taxRatesLoading } = useQuery({
    queryKey: ["moneybird_tax_rates"],
    queryFn: () => dataProvider.getMoneybirdTaxRates(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Pre-select the 21% rate once the rates have loaded.
  useEffect(() => {
    if (!taxRateId && taxRates?.length) {
      const preferred =
        taxRates.find((rate) => rate.percentage === DEFAULT_TAX_PERCENTAGE) ??
        taxRates[0];
      setTaxRateId(preferred.id);
    }
  }, [taxRates, taxRateId]);

  // Hard blocks: no safe default exists for a missing company, amount, or a
  // non-EUR currency (the administration is EUR-only).
  const missingCompany = !record.company_id;
  const missingAmount = !record.amount || record.amount <= 0;
  const wrongCurrency = currency !== "EUR";
  const blocked = missingCompany || missingAmount || wrongCurrency;

  const contactCount = record.contact_ids?.length ?? 0;

  const { mutateAsync } = useMutation({
    mutationKey: ["deals", "moneybird_estimate", record.id],
    mutationFn: () =>
      dataProvider.createMoneybirdEstimate({
        dealId: record.id,
        taxRateId,
        description,
      }),
  });

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      await mutateAsync();
      notify("resources.deals.moneybird.success", { type: "success" });
      refresh();
      onClose();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : translate("resources.deals.moneybird.error"),
        { type: "error" },
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:min-w-lg max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {translate("resources.deals.moneybird.dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {translate("resources.deals.moneybird.dialog_description")}
          </DialogDescription>
        </DialogHeader>

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
                {formatAmount(record.amount, currency)}
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
                rows={3}
              />
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
            </div>

            {contactCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                {translate("resources.deals.moneybird.no_contact_hint")}
              </p>
            ) : null}
            {contactCount > 1 ? (
              <p className="text-xs text-muted-foreground">
                {translate("resources.deals.moneybird.multiple_contacts_hint")}
              </p>
            ) : null}

            <Alert>
              <AlertTitle>
                {translate("resources.deals.moneybird.warning_title")}
              </AlertTitle>
              <AlertDescription>
                {translate("resources.deals.moneybird.warning")}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            {translate("ra.action.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={blocked || isCreating || !taxRateId}
          >
            <Receipt className="w-4 h-4" />
            {isCreating
              ? translate("resources.deals.moneybird.creating")
              : translate("resources.deals.moneybird.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ViewMoneybirdEstimateButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();

  // The administration id is not a secret (it appears in Moneybird URLs); it is
  // exposed as a public build env var so the deep link can be built client-side.
  const href = useMemo(() => {
    const adminId = import.meta.env.VITE_MONEYBIRD_ADMIN_ID as
      | string
      | undefined;
    if (adminId && record.moneybird_estimate_id) {
      return `https://moneybird.com/${adminId}/estimates/${record.moneybird_estimate_id}`;
    }
    return "https://moneybird.com";
  }, [record.moneybird_estimate_id]);

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink className="w-4 h-4" />
        {translate("resources.deals.moneybird.view")}
      </a>
    </Button>
  );
};
