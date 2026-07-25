import { useGetList, useTranslate } from "ra-core";
import { lazy, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { MobilePage } from "../layout/MobilePage";
import { PageBody } from "../layout/PageBody";
import { PageHeader } from "../layout/PageHeader";
import type { Deal } from "../types";
import { BillingQueue } from "./BillingQueue";

const RevenueDashboard = lazy(() =>
  import("./RevenueDashboard").then((module) => ({
    default: module.RevenueDashboard,
  })),
);

const useFinanceMeta = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });
  if (isPending) return null;
  const toInvoice = deals.filter(
    (deal) => deal.stage === "facturatie-live",
  ).length;
  return translate("crm.finance.meta", {
    smart_count: toInvoice,
    _:
      toInvoice === 1
        ? "1 opdracht klaar om te factureren"
        : `${toInvoice} opdrachten klaar om te factureren`,
  });
};

const RevenueChart = () => (
  <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
    <RevenueDashboard />
  </Suspense>
);

/**
 * Money in one place: the month chart with its forecast, and the queue of work
 * that is finished but not yet invoiced.
 *
 * The chart used to hide behind a collapsed "Omzet en prognose" button inside a
 * dashboard tab, so the number people care about most took two clicks.
 */
export const FinancePage = () => {
  const translate = useTranslate();
  const meta = useFinanceMeta();

  return (
    <>
      <PageHeader
        title={translate("crm.navigation.finance", { _: "Financieel" })}
        meta={meta}
      />
      <PageBody className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <RevenueChart />
        </div>
        {/* The queue is a table: it needs more than a third of the width before
            the action column starts clipping. */}
        <div className="min-w-0 xl:col-span-5">
          <BillingQueue />
        </div>
      </PageBody>
    </>
  );
};

export const MobileFinancePage = () => {
  const translate = useTranslate();
  return (
    <MobilePage
      title={translate("crm.navigation.finance", { _: "Financieel" })}
    >
      <div className="flex flex-col gap-6">
        <BillingQueue />
        <RevenueChart />
      </div>
    </MobilePage>
  );
};
