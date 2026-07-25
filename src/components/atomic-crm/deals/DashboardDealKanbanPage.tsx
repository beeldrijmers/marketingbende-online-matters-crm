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
  type AttentionPipelineFilter,
} from "./dashboardDealKanbanModel";
import {
  createDashboardDealSelection,
  getDashboardDealSelectionPath,
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
      <div className="flex min-h-0 flex-1 flex-col gap-3">
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
      </div>
    </ResourceContextProvider>
  );
};

/**
 * The phone's board: one ranked, tappable list per focus.
 *
 * The attention focus deliberately drops the desktop filter chips — the list is
 * already ordered by urgency, and on 390px every extra control row pushes the
 * first card off screen.
 */
export const MobileBoardPage = () => {
  const [searchParams] = useSearchParams();
  const focus = searchParams.get("focus");
  if (focus === "attention") return <MobileAttentionBoard />;
  return <MobileDealsList />;
};

const MobileAttentionBoard = () => {
  const { isPending, selection } = useAttentionDealSelection();
  if (isPending) return <DashboardDealKanbanSkeleton />;
  return (
    <ResourceContextProvider value="deals">
      <MobileDealsList attentionPipeline dashboardSelection={selection} />
    </ResourceContextProvider>
  );
};
export const AttentionDealsDashboard = ({
  mobile = false,
}: {
  mobile?: boolean;
}) => <AttentionDealsPage embedded mobile={mobile} />;

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
