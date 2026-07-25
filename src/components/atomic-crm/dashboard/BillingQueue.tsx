import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ReceiptText,
} from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { MoneybirdDocumentControl } from "../deals/MoneybirdDocumentButtons";
import {
  BOARD_PATH,
  getDashboardDealDetailPath,
  getDashboardDealEditPath,
} from "../deals/dashboardDealSelection";
import { SectionHeader } from "../layout/SectionHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { type BillingState, getBillingState } from "./billingQueueModel";

const priority: Record<BillingState["kind"], number> = {
  failed: 0,
  incomplete: 1,
  ready: 2,
  pending: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const daysWaiting = (deal: Deal): number | null => {
  const since = deal.updated_at ?? deal.created_at;
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS);
  return Number.isFinite(days) && days >= 0 ? days : null;
};

/**
 * Everything that is finished but not yet invoiced.
 *
 * This used to be a three-item teaser next to a "Kanban" link that opened the
 * whole eight-column board to show five records. It is a queue, so it is a
 * table: client, work, amount, how long it has been waiting, and the one action
 * that clears the row.
 */
export const BillingQueue = () => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
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
    <section className="flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title={translate("crm.billing.title", {
          _: "Facturatie afhandelen",
        })}
        count={queue.length}
        meta={
          isPending
            ? null
            : translate("crm.billing.meta", {
                ready: readyCount,
                incomplete: incompleteCount,
                _: `${readyCount} klaar, ${incompleteCount} eerst aanvullen`,
              })
        }
      />

      {isPending ? (
        <div className="panel flex flex-col gap-2 p-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-sm" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="panel flex items-start gap-2.5 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-live" />
          <div>
            <p className="text-body font-medium text-ink">
              {translate("crm.billing.empty_title", {
                _: "Facturatie is bijgewerkt",
              })}
            </p>
            <p className="text-meta text-ink-3">
              {translate("crm.billing.empty", {
                _: "Er staat geen afgerond werk meer te wachten op een factuur.",
              })}
            </p>
          </div>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-line-subtle text-left">
                <th className="eyebrow px-3 py-2 font-semibold">
                  {translate("resources.deals.fields.company_id")}
                </th>
                <th className="eyebrow px-3 py-2 text-right font-semibold">
                  {translate("resources.deals.fields.amount")}
                </th>
                <th className="eyebrow hidden px-3 py-2 text-right font-semibold sm:table-cell">
                  {translate("crm.billing.waiting", { _: "Wacht" })}
                </th>
                <th className="px-3 py-2">
                  <span className="sr-only">
                    {translate("ra.action.edit", { _: "Actie" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {queue.map(({ deal, state }) => {
                const waiting = daysWaiting(deal);
                return (
                  <RecordContextProvider key={deal.id} value={deal}>
                    <tr className="border-b border-line-subtle last:border-0 hover:bg-sunken">
                      <td className="min-w-0 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <ReferenceField
                            source="company_id"
                            reference="companies"
                            link={false}
                          >
                            <CompanyAvatar width={20} height={20} />
                          </ReferenceField>
                          <Link
                            to={getDashboardDealDetailPath(BOARD_PATH, deal.id)}
                            className="min-w-0 no-underline hover:underline"
                          >
                            <span className="block truncate font-medium text-ink">
                              <ReferenceField
                                source="company_id"
                                reference="companies"
                                link={false}
                              />
                            </span>
                            <span className="block truncate text-meta text-ink-3">
                              {deal.name}
                            </span>
                          </Link>
                        </div>
                        <BillingStateLabel state={state} />
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-medium text-ink">
                        {deal.amount
                          ? deal.amount.toLocaleString("nl-NL", {
                              style: "currency",
                              currency,
                              maximumFractionDigits: 0,
                            })
                          : null}
                      </td>
                      <td className="num hidden whitespace-nowrap px-3 py-2 text-right text-meta text-ink-3 sm:table-cell">
                        {waiting != null
                          ? translate("crm.billing.days", {
                              smart_count: waiting,
                              _: `${waiting} d`,
                            })
                          : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {state.kind === "ready" ? (
                          <MoneybirdDocumentControl
                            record={deal}
                            kind="invoice"
                          />
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to={getDashboardDealEditPath(BOARD_PATH, deal.id)}
                            >
                              {translate("crm.billing.complete", {
                                _: "Aanvullen",
                              })}
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  </RecordContextProvider>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const BillingStateLabel = ({ state }: { state: BillingState }) => {
  const Icon =
    state.kind === "failed"
      ? FileWarning
      : state.kind === "incomplete"
        ? AlertTriangle
        : ReceiptText;
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex items-center gap-1 text-meta",
        state.kind === "ready"
          ? "text-live"
          : state.kind === "pending"
            ? "text-info"
            : "text-wait",
      )}
    >
      <Icon className="size-3 shrink-0" />
      {state.label}
    </span>
  );
};
