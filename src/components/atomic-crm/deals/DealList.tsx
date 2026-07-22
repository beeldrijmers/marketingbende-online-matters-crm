import { useState, type ReactNode } from "react";
import type { InputProps } from "ra-core";
import { useGetIdentity, useListContext, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { Plus } from "lucide-react";
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
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import type { Deal } from "../types";
import { AttentionMovePrompt } from "./AttentionMovePrompt";
import { CompletionScopeInput } from "./CompletionScopeInput";
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
  DASHBOARD_WORKBOARD_PATH,
  type DashboardDealSelection,
  getDashboardDealCreatePath,
  getDashboardDealDetailPath,
  getDashboardDealEditPath,
  getDashboardDealReturnPath,
  getDashboardDealSelectionPath,
  getDashboardDealSelectionFilter,
} from "./dashboardDealSelection";
import { findDealLabel } from "./dealUtils";

type DealListProps = {
  dashboardSelection?: DashboardDealSelection;
  detailBasePath?: string;
  embedded?: boolean;
};

export const DealList = ({
  dashboardSelection,
  detailBasePath,
  embedded = false,
}: DealListProps = {}) => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  const attentionPipeline = dashboardSelection?.kind === "attention";

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
    <CompletionScopeInput source="stage@neq" alwaysOn />,
    <OnlyMineInput source="sales_id" alwaysOn />,
  ];

  return (
    <List
      // The kanban has no pagination, so everything beyond perPage would
      // silently disappear from the board; 1000 matches MobileDealsList.
      perPage={1000}
      filter={{
        "archived_at@is": null,
        ...getDashboardDealSelectionFilter(dashboardSelection ?? null),
      }}
      disableBreadcrumb={embedded || attentionPipeline}
      disableHeader={attentionPipeline}
      disableSyncWithLocation={embedded}
      hideTitle={embedded}
      title={attentionPipeline ? false : (dashboardSelection?.label ?? false)}
      sort={{ field: "index", order: "DESC" }}
      filters={attentionPipeline ? undefined : dealFilters}
      actions={
        attentionPipeline ? (
          false
        ) : (
          <DealActions
            detailBasePath={
              detailBasePath ??
              (embedded ? DASHBOARD_WORKBOARD_PATH : undefined)
            }
            embedded={embedded}
          />
        )
      }
      pagination={null}
      storeKey={
        dashboardSelection
          ? `deals.${dashboardSelection.kind}`
          : "deals.full-workboard.v1"
      }
    >
      <DealLayout
        dashboardSelection={dashboardSelection}
        detailBasePath={detailBasePath}
        embedded={embedded}
      />
    </List>
  );
};

const DealLayout = ({
  dashboardSelection,
  detailBasePath,
  embedded,
}: {
  dashboardSelection?: DashboardDealSelection;
  detailBasePath?: string;
  embedded: boolean;
}) => {
  const translate = useTranslate();
  const location = useLocation();
  const { dealStages } = useConfigurationContext();
  const [recentMove, setRecentMove] = useState<{
    deal: Deal;
    destinationStage: string;
  } | null>(null);
  const [taskDeal, setTaskDeal] = useState<Deal | null>(null);
  const attentionPipeline = dashboardSelection?.kind === "attention";
  const resolvedDetailBasePath =
    detailBasePath ??
    (dashboardSelection
      ? getDashboardDealSelectionPath(dashboardSelection.kind)
      : embedded
        ? DASHBOARD_WORKBOARD_PATH
        : undefined);
  const dashboardReturnPath = resolvedDetailBasePath
    ? getDashboardDealReturnPath(resolvedDetailBasePath, location.search)
    : undefined;
  const dashboardParams = new URLSearchParams(location.search);
  const dashboardDealId =
    dashboardSelection || embedded ? dashboardParams.get("deal") : null;
  const dashboardEditId = embedded ? dashboardParams.get("edit") : null;
  const dashboardCreateOpen = embedded && dashboardParams.get("new") === "1";
  const matchCreate =
    dashboardSelection || embedded
      ? null
      : matchPath("/deals/create", location.pathname);
  const matchShow =
    dashboardSelection || embedded
      ? null
      : matchPath("/deals/:id/show", location.pathname);
  const matchEdit =
    dashboardSelection || embedded
      ? null
      : matchPath("/deals/:id", location.pathname);
  const createOpen = dashboardCreateOpen || !!matchCreate;
  const editId = dashboardEditId ?? matchEdit?.params.id;
  const showId = dashboardDealId ?? matchShow?.params.id;
  const createTo = dashboardReturnPath
    ? getDashboardDealCreatePath(dashboardReturnPath)
    : undefined;

  const { data, isPending, filterValues, total } = useListContext<Deal>();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const dashboardSelectionCount = total ?? dashboardSelection?.ids.length ?? 0;

  if (isPending) return <DealListSkeleton />;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty
          createCloseTo={dashboardReturnPath}
          createOpen={createOpen}
          createTo={createTo}
        >
          <DealShow
            closeTo={dashboardReturnPath ?? "/deals"}
            editTo={
              showId && dashboardReturnPath
                ? getDashboardDealEditPath(dashboardReturnPath, showId)
                : undefined
            }
            open={Boolean(showId)}
            id={showId}
          />
          <DealArchivedList detailBasePath={dashboardReturnPath} />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      {dashboardSelection && !attentionPipeline ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {translate("resources.deals.dashboard_selection", {
              count: dashboardSelectionCount,
              label: dashboardSelection.label,
              _: `${dashboardSelection.label}: ${dashboardSelectionCount} deals`,
            })}
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link to={DASHBOARD_WORKBOARD_PATH} replace>
              {translate("resources.deals.all_deals", {
                _: "Alle opdrachten",
              })}
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
      <DealListContent
        attentionPipeline={attentionPipeline}
        detailBasePath={dashboardReturnPath}
        embedded={embedded}
        onDealStageChange={
          attentionPipeline
            ? (deal, destinationStage) =>
                setRecentMove({ deal, destinationStage })
            : undefined
        }
        onPlanTask={setTaskDeal}
      />
      <DealCreate closeTo={dashboardReturnPath} open={createOpen} />
      <DealEdit
        closeTo={dashboardReturnPath}
        open={Boolean(editId) && !createOpen}
        id={editId}
        showTo={
          editId && dashboardReturnPath
            ? getDashboardDealDetailPath(dashboardReturnPath, editId)
            : undefined
        }
      />
      <DealShow
        closeTo={dashboardReturnPath ?? "/deals"}
        editTo={
          showId && dashboardReturnPath
            ? getDashboardDealEditPath(dashboardReturnPath, showId)
            : undefined
        }
        open={Boolean(showId)}
        id={showId}
      />
      {recentMove ? (
        <AttentionMovePrompt
          deal={recentMove.deal}
          destinationLabel={
            findDealLabel(dealStages, recentMove.destinationStage) ??
            recentMove.destinationStage
          }
          onDismiss={() => setRecentMove(null)}
        />
      ) : null}
      <TaskCreateSheet
        open={taskDeal != null}
        deal_id={taskDeal?.id}
        onOpenChange={(open) => {
          if (!open) setTaskDeal(null);
        }}
      />
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

const DealActions = ({
  detailBasePath,
  embedded,
}: {
  detailBasePath?: string;
  embedded: boolean;
}) => {
  const location = useLocation();
  const translate = useTranslate();
  const returnPath = detailBasePath
    ? getDashboardDealReturnPath(detailBasePath, location.search)
    : undefined;

  return (
    <TopToolbar>
      {!embedded ? <SyncTrelloButton /> : null}
      <FilterButton />
      <DealArchivedList detailBasePath={returnPath} />
      <ExportButton />
      {embedded && returnPath ? (
        <Button asChild size="sm">
          <Link to={getDashboardDealCreatePath(returnPath)}>
            <Plus className="size-4" />
            {translate("resources.deals.action.new")}
          </Link>
        </Button>
      ) : (
        <CreateButton label="resources.deals.action.new" />
      )}
    </TopToolbar>
  );
};

/**
 *
 * Used so that label of filters can be inferred for the select display,
 * but not be displayed when showing the input.
 */
const WrapperField = ({ children }: InputProps & { children: ReactNode }) =>
  children;

export default DealList;
