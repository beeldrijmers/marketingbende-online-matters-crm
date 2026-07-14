import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  ReceiptText,
} from "lucide-react";
import { RecordContextProvider, useGetList } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { MoneybirdDocumentControl } from "../deals/MoneybirdDocumentButtons";
import type { Deal } from "../types";

const PAGE_SIZE = 3;

type BillingState =
  | { kind: "failed"; label: string }
  | { kind: "incomplete"; label: string }
  | { kind: "pending"; label: string }
  | { kind: "ready"; label: string };

export const getBillingState = (deal: Deal): BillingState | null => {
  if (
    deal.moneybird_invoice_id &&
    deal.moneybird_invoice_status === "completed"
  ) {
    return null;
  }
  if (deal.moneybird_invoice_status === "failed") {
    return { kind: "failed", label: "Moneybird-fout controleren" };
  }
  if (deal.moneybird_invoice_status === "pending") {
    return { kind: "pending", label: "Factuur wordt aangemaakt" };
  }

  const missing = [
    !deal.company_id ? "bedrijf" : null,
    !deal.contact_ids?.length ? "contact" : null,
    !deal.amount || deal.amount <= 0 ? "bedrag" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      kind: "incomplete",
      label: `Mist ${missing.join(", ")}`,
    };
  }
  return { kind: "ready", label: "Klaar om te factureren" };
};

const priority: Record<BillingState["kind"], number> = {
  failed: 0,
  incomplete: 1,
  ready: 2,
  pending: 3,
};

export const BillingQueue = () => {
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "ASC" },
    filter: { stage: "facturatie-live", "archived_at@is": null },
  });
  const queue = deals
    .map((deal) => ({ deal, state: getBillingState(deal) }))
    .filter(
      (item): item is { deal: Deal; state: BillingState } => item.state != null,
    )
    .sort(
      (left, right) => priority[left.state.kind] - priority[right.state.kind],
    );
  const readyCount = queue.filter(({ state }) => state.kind === "ready").length;
  const incompleteCount = queue.filter(
    ({ state }) => state.kind === "incomplete" || state.kind === "failed",
  ).length;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-3">
        <ReceiptText className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            Facturatie afhandelen
          </h2>
          <p className="text-xs text-muted-foreground">
            {readyCount} klaar · {incompleteCount} eerst aanvullen
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to="/deals">
            Kanban
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <Card className="divide-y overflow-hidden py-0">
        {isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="flex items-start gap-3 bg-emerald-500/5 p-5">
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">Facturatie is bijgewerkt</p>
              <p className="text-sm text-muted-foreground">
                Er staan geen deals meer te wachten op een Moneybird-factuur.
              </p>
            </div>
          </div>
        ) : (
          queue.slice(0, PAGE_SIZE).map(({ deal, state }) => (
            <RecordContextProvider key={deal.id} value={deal}>
              <div className="flex min-w-0 items-center gap-3 p-4">
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                >
                  <CompanyAvatar width={20} height={20} />
                </ReferenceField>
                <Link
                  to={`/deals/${deal.id}/show`}
                  className="min-w-0 flex-1 no-underline hover:underline"
                >
                  <span className="block truncate text-sm font-semibold">
                    <ReferenceField
                      source="company_id"
                      reference="companies"
                      link={false}
                    />
                    {" - "}
                    {deal.name}
                  </span>
                  <BillingBadge state={state} />
                </Link>
                {state.kind === "ready" ? (
                  <MoneybirdDocumentControl record={deal} kind="invoice" />
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/deals/${deal.id}`}>Aanvullen</Link>
                  </Button>
                )}
              </div>
            </RecordContextProvider>
          ))
        )}
      </Card>

      {!isPending && queue.length > PAGE_SIZE ? (
        <p className="text-right text-xs text-muted-foreground">
          Nog {queue.length - PAGE_SIZE} facturatie-acties op het kanbanbord
        </p>
      ) : null}
    </section>
  );
};

const BillingBadge = ({ state }: { state: BillingState }) => {
  const Icon =
    state.kind === "failed"
      ? FileWarning
      : state.kind === "incomplete"
        ? AlertTriangle
        : ReceiptText;
  return (
    <Badge
      variant="outline"
      className={
        state.kind === "ready"
          ? "mt-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          : state.kind === "pending"
            ? "mt-1 border-blue-500/30 text-blue-700 dark:text-blue-300"
            : "mt-1 border-amber-500/30 text-amber-700 dark:text-amber-300"
      }
    >
      <Icon className="size-3" />
      {state.label}
    </Badge>
  );
};
