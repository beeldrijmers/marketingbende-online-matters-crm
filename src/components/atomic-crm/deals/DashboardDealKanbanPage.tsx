import { ResourceContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getBillingState } from "../dashboard/billingQueueModel";
import type { Deal, Task } from "../types";
import { DealList } from "./DealList";
import { MobileDealsList } from "./MobileDealsList";
import {
  createDashboardDealSelection,
  type DashboardDealSelection,
} from "./dashboardDealSelection";
import { buildOpenTasksByDeal, rankDealsForAttention } from "./dealWorkflow";

export const selectAttentionDealIds = (
  deals: Deal[],
  tasks: Task[],
  now: Date = new Date(),
) =>
  rankDealsForAttention(deals, buildOpenTasksByDeal(tasks), now).map(
    ({ deal }) => deal.id,
  );

export const selectBillingDealIds = (deals: Deal[]) =>
  deals
    .filter(
      (deal) =>
        deal.stage === "facturatie-live" && getBillingState(deal) != null,
    )
    .map((deal) => deal.id);

const useAttentionDealSelection = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
  );
  const { data: tasks = [], isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );
  const label = translate("crm.dashboard.deal_actions.title", {
    _: "Dit heeft je aandacht nodig",
  });
  const selection = useMemo(
    () =>
      createDashboardDealSelection(
        selectAttentionDealIds(deals, tasks),
        "attention",
        label,
      ),
    [deals, label, tasks],
  );
  return { isPending: dealsPending || tasksPending, selection };
};

const useBillingDealSelection = () => {
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "ASC" },
    filter: { stage: "facturatie-live", "archived_at@is": null },
  });
  const selection = useMemo(
    () =>
      createDashboardDealSelection(
        selectBillingDealIds(deals),
        "billing",
        "Facturatie afhandelen",
      ),
    [deals],
  );
  return { isPending, selection };
};

const DashboardDealKanban = ({
  isPending,
  mobile,
  selection,
}: {
  isPending: boolean;
  mobile: boolean;
  selection: DashboardDealSelection;
}) => {
  if (isPending) return <DashboardDealKanbanSkeleton />;

  return (
    <ResourceContextProvider value="deals">
      {mobile ? (
        <MobileDealsList dashboardSelection={selection} />
      ) : (
        <DealList dashboardSelection={selection} />
      )}
    </ResourceContextProvider>
  );
};

const AttentionDealsPage = ({ mobile = false }: { mobile?: boolean }) => {
  const { isPending, selection } = useAttentionDealSelection();
  return (
    <DashboardDealKanban
      isPending={isPending}
      mobile={mobile}
      selection={selection}
    />
  );
};

const BillingDealsPage = ({ mobile = false }: { mobile?: boolean }) => {
  const { isPending, selection } = useBillingDealSelection();
  return (
    <DashboardDealKanban
      isPending={isPending}
      mobile={mobile}
      selection={selection}
    />
  );
};

export const AttentionDealsKanbanPage = () => <AttentionDealsPage />;
export const BillingDealsKanbanPage = () => <BillingDealsPage />;
export const MobileAttentionDealsKanbanPage = () => (
  <AttentionDealsPage mobile />
);
export const MobileBillingDealsKanbanPage = () => <BillingDealsPage mobile />;

const DashboardDealKanbanSkeleton = () => (
  <div className="flex flex-col gap-4 py-2">
    <Skeleton className="h-8 w-72" />
    <div className="flex min-h-80 gap-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-80 min-w-56 flex-1" />
      ))}
    </div>
  </div>
);
