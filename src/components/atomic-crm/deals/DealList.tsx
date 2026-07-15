import type { ReactNode } from "react";
import type { InputProps } from "ra-core";
import { useGetIdentity, useListContext, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";
import { InternalExternalInput } from "./InternalExternalInput";
import { SyncTrelloButton } from "./SyncTrelloButton";
import {
  getDashboardDealSelectionFilter,
  readDashboardDealSelection,
} from "./dashboardDealSelection";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  const location = useLocation();
  const dashboardSelection = readDashboardDealSelection(location.state);

  if (!identity) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput
        label={false}
        placeholder={translate("resources.deals.fields.company_id")}
      />
    </ReferenceInput>,
    <WrapperField source="category" label="resources.deals.fields.category">
      <SelectInput
        source="category"
        label={false}
        emptyText="resources.deals.fields.category"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
      />
    </WrapperField>,
    <InternalExternalInput source="is_internal" alwaysOn />,
    <OnlyMineInput source="sales_id" alwaysOn />,
  ];

  return (
    <List
      // The kanban has no pagination, so everything beyond perPage would
      // silently disappear from the board; 1000 matches MobileDealsList.
      perPage={1000}
      filter={{
        "archived_at@is": null,
        ...getDashboardDealSelectionFilter(dashboardSelection),
      }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
    >
      <DealLayout />
    </List>
  );
};

const DealLayout = () => {
  const translate = useTranslate();
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const dashboardSelection = readDashboardDealSelection(location.state);

  const { data, isPending, filterValues, total } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const dashboardSelectionCount = total ?? dashboardSelection?.ids.length ?? 0;

  if (isPending) return <DealListSkeleton />;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealShow open={!!matchShow} id={matchShow?.params.id} />
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      {dashboardSelection ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {translate("resources.deals.dashboard_selection", {
              count: dashboardSelectionCount,
              label: dashboardSelection.label,
              _: `${dashboardSelection.label}: ${dashboardSelectionCount} deals`,
            })}
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/deals" replace>
              {translate("resources.deals.all_deals", { _: "Alle deals" })}
            </Link>
          </Button>
        </div>
      ) : null}
      {/* Safety net: should there ever be more deals than one page holds,
          say so instead of silently hiding them from the board. */}
      {data && total != null && total > data.length ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {translate("resources.deals.partial_load", {
            loaded: data.length,
            total,
          })}
        </p>
      ) : null}
      <DealListContent />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </div>
  );
};

const DealListSkeleton = () => {
  const { dealStages } = useConfigurationContext();
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {dealStages.map((stage) => (
        <div key={stage.value} className="flex-1 min-w-56 pb-8">
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const DealActions = () => (
  <TopToolbar>
    <SyncTrelloButton />
    <FilterButton />
    <DealArchivedList />
    <ExportButton />
    <CreateButton label="resources.deals.action.new" />
  </TopToolbar>
);

/**
 *
 * Used so that label of filters can be inferred for the select display,
 * but not be displayed when showing the input.
 */
const WrapperField = ({ children }: InputProps & { children: ReactNode }) =>
  children;

export default DealList;
