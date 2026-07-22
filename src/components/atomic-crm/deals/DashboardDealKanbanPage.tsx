import { ResourceContextProvider, useGetList, useTranslate } from "ra-core";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Deal, Task } from "../types";
import { AttentionPipelineHeader } from "./AttentionPipelineHeader";
import { DealList } from "./DealList";
import { MobileDealsList } from "./MobileDealsList";
import {
  filterAttentionDeals,
  filterAttentionDealsBySearch,
  parseAttentionPipelineFilter,
  selectAttentionDeals,
  selectBillingDealIds,
  type AttentionPipelineFilter,
} from "./dashboardDealKanbanModel";
import {
  createDashboardDealSelection,
  getDashboardDealSelectionPath,
  type DashboardDealSelection,
} from "./dashboardDealSelection";
import { summarizeDealAttention } from "./dealWorkflow";

const useAttentionDealSelection = () => {
  const translate = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseAttentionPipelineFilter(searchParams.get("filter"));
  const search = searchParams.get("q") ?? "";
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
  const { data: companies = [], isPending: companiesPending } =
    useGetList<Company>("companies", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "name", order: "ASC" },
      filter: {},
    });
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
  const companyNames = useMemo(
    () =>
      new Map(
        companies.map((company) => [String(company.id), company.name] as const),
      ),
    [companies],
  );
  const visibleDeals = useMemo(
    () =>
      filterAttentionDealsBySearch(
        filterAttentionDeals(rankedDeals, filter),
        search,
        companyNames,
      ),
    [companyNames, filter, rankedDeals, search],
  );
  const selection = useMemo(
    () =>
      createDashboardDealSelection(
        visibleDeals.map(({ deal }) => deal.id),
        "attention",
        label,
      ),
    [label, visibleDeals],
  );
  const setFilter = useCallback(
    (nextFilter: AttentionPipelineFilter) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextFilter === "all") next.delete("filter");
          else next.set("filter", nextFilter);
          next.delete("deal");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setSearch = useCallback(
    (nextSearch: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextSearch) next.set("q", nextSearch.slice(0, 120));
          else next.delete("q");
          next.delete("deal");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return {
    counts,
    filter,
    isPending: dealsPending || tasksPending || companiesPending,
    search,
    selection,
    setFilter,
    setSearch,
    visibleCount: visibleDeals.length,
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
  embedded = false,
  isPending,
  mobile,
  selection,
}: {
  embedded?: boolean;
  isPending: boolean;
  mobile: boolean;
  selection: DashboardDealSelection;
}) => {
  if (isPending) return <DashboardDealKanbanSkeleton />;

  return (
    <ResourceContextProvider value="deals">
      {mobile && !embedded ? (
        <MobileDealsList dashboardSelection={selection} />
      ) : (
        <DealList
          dashboardSelection={selection}
          detailBasePath={getDashboardDealSelectionPath(selection.kind)}
          embedded={embedded}
        />
      )}
    </ResourceContextProvider>
  );
};

const AttentionDealsPage = ({
  embedded = false,
  mobile = false,
}: {
  embedded?: boolean;
  mobile?: boolean;
}) => {
  const {
    counts,
    filter,
    isPending,
    search,
    selection,
    setFilter,
    setSearch,
    visibleCount,
  } = useAttentionDealSelection();
  if (isPending) return <DashboardDealKanbanSkeleton />;

  return (
    <ResourceContextProvider value="deals">
      <AttentionPipelineHeader
        counts={counts}
        embedded={embedded}
        filter={filter}
        mobile={mobile}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        search={search}
        visibleCount={visibleCount}
      />
      {mobile && !embedded ? (
        <MobileDealsList
          attentionPipeline
          dashboardSelection={selection}
          hideHeader
        />
      ) : (
        <DealList
          dashboardSelection={selection}
          detailBasePath={getDashboardDealSelectionPath(selection.kind)}
          embedded={embedded}
        />
      )}
    </ResourceContextProvider>
  );
};

const BillingDealsPage = ({
  embedded = false,
  mobile = false,
}: {
  embedded?: boolean;
  mobile?: boolean;
}) => {
  const { isPending, selection } = useBillingDealSelection();
  return (
    <DashboardDealKanban
      embedded={embedded}
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
export const AttentionDealsDashboard = ({
  mobile = false,
}: {
  mobile?: boolean;
}) => <AttentionDealsPage embedded mobile={mobile} />;
export const BillingDealsDashboard = ({
  mobile = false,
}: {
  mobile?: boolean;
}) => <BillingDealsPage embedded mobile={mobile} />;

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
