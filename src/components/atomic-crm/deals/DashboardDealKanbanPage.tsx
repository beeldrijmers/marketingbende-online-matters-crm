import { ResourceContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Deal, Task } from "../types";
import { AttentionPipelineHeader } from "./AttentionPipelineHeader";
import { DealList } from "./DealList";
import { MobileDealsList } from "./MobileDealsList";
import {
  filterAttentionDeals,
  selectAttentionDeals,
  selectBillingDealIds,
  type AttentionPipelineFilter,
} from "./dashboardDealKanbanModel";
import {
  createDashboardDealSelection,
  type DashboardDealSelection,
} from "./dashboardDealSelection";
import { summarizeDealAttention } from "./dealWorkflow";

const useAttentionDealSelection = () => {
  const translate = useTranslate();
  const [filter, setFilter] = useState<AttentionPipelineFilter>("all");
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
  const rankedDeals = useMemo(
    () => selectAttentionDeals(deals, tasks),
    [deals, tasks],
  );
  const counts = useMemo(
    () => summarizeDealAttention(rankedDeals),
    [rankedDeals],
  );
  const selection = useMemo(
    () =>
      createDashboardDealSelection(
        filterAttentionDeals(rankedDeals, filter).map(({ deal }) => deal.id),
        "attention",
        label,
      ),
    [filter, label, rankedDeals],
  );
  return {
    counts,
    filter,
    isPending: dealsPending || tasksPending,
    selection,
    setFilter,
  };
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
  const { counts, filter, isPending, selection, setFilter } =
    useAttentionDealSelection();
  if (isPending) return <DashboardDealKanbanSkeleton />;

  return (
    <ResourceContextProvider value="deals">
      <AttentionPipelineHeader
        counts={counts}
        filter={filter}
        mobile={mobile}
        onFilterChange={setFilter}
      />
      {mobile ? (
        <MobileDealsList
          attentionPipeline
          dashboardSelection={selection}
          hideHeader
        />
      ) : (
        <DealList dashboardSelection={selection} />
      )}
    </ResourceContextProvider>
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
