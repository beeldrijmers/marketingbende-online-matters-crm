import { CircleDollarSign, FileText, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { MoneybirdDocumentControl } from "./MoneybirdDocumentButtons";

const formatAmount = (amount: number, currency: string): string =>
  amount.toLocaleString("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const MoneybirdDealSection = ({ record }: { record: Deal }) => {
  const { currency } = useConfigurationContext();
  if (record.is_internal) return null;

  const amountLabel =
    record.amount != null && record.amount > 0
      ? formatAmount(record.amount, currency)
      : null;
  const amountKnown = amountLabel !== null;

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
              {record.moneybird_estimate_id
                ? "Offerte aanwezig"
                : "Nog geen offerte"}
            </Badge>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Receipt className="size-3" />
              {record.moneybird_invoice_id
                ? "Factuur aanwezig"
                : "Nog geen factuur"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <MoneybirdDocumentControl record={record} kind="estimate" />
          <MoneybirdDocumentControl record={record} kind="invoice" />
        </div>
      </div>
    </section>
  );
};
