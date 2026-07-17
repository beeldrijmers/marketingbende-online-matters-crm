import { useMemo, useState } from "react";
import {
  InfiniteListBase,
  RecordContextProvider,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useListContext,
  useNotify,
  useTranslate,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import { AssigneesField } from "../sales/AssigneesField";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import type { Deal, DealStage, Task } from "../types";
import { AttentionDealActions } from "./AttentionDealActions";
import { AttentionMovePrompt } from "./AttentionMovePrompt";
import { CompletionScopeInput } from "./CompletionScopeInput";
import { DealShow } from "./DealShow";
import { DealWorkflowIndicator } from "./DealWorkflowIndicator";
import {
  type DashboardDealSelection,
  getDashboardDealDetailPath,
  getDashboardDealReturnPath,
  getDashboardDealSelectionPath,
  getDashboardDealSelectionFilter,
} from "./dashboardDealSelection";
import {
  buildOpenTasksByDeal,
  getDealWorkflow,
  rankDealsForAttention,
} from "./dealWorkflow";
import { findDealLabel } from "./dealUtils";
import { persistDealStageMove } from "./dealStageMove";

/**
 * Mobile deals view: the kanban board is desktop-only, so on mobile the deals
 * are shown as a tappable list grouped by stage (the columns of the desktop
 * board become sections). Each row shows company, name, amount and owner +
 * party. Registered as the `deals` list in the mobile Admin.
 */
export const MobileDealsList = ({
  attentionPipeline = false,
  dashboardSelection,
  hideHeader = false,
}: {
  attentionPipeline?: boolean;
  dashboardSelection?: DashboardDealSelection;
  hideHeader?: boolean;
} = {}) => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <InfiniteListBase
      perPage={1000}
      filter={{
        "archived_at@is": null,
        ...getDashboardDealSelectionFilter(dashboardSelection ?? null),
      }}
      filterDefaultValues={
        dashboardSelection ? undefined : { "stage@neq": "won" }
      }
      sort={{ field: "index", order: "ASC" }}
      storeKey={
        dashboardSelection
          ? `deals.mobile.${dashboardSelection.kind}`
          : undefined
      }
    >
      <DealsLayoutMobile
        attentionPipeline={attentionPipeline}
        dashboardSelection={dashboardSelection}
        hideHeader={hideHeader}
      />
    </InfiniteListBase>
  );
};

type DealGroup = { key: string; label: string; deals: Deal[] };

const groupDealsByStage = (
  deals: Deal[],
  dealStages: DealStage[],
  fallbackLabel: string,
): DealGroup[] => {
  const byStage = new Map<string, Deal[]>();
  for (const deal of deals) {
    const key = deal.stage ?? "";
    const bucket = byStage.get(key);
    if (bucket) bucket.push(deal);
    else byStage.set(key, [deal]);
  }

  const groups: DealGroup[] = [];
  // Configured stages first, in the pipeline order.
  for (const stage of dealStages) {
    const stageDeals = byStage.get(stage.value);
    if (stageDeals?.length) {
      groups.push({ key: stage.value, label: stage.label, deals: stageDeals });
      byStage.delete(stage.value);
    }
  }
  // Any deals with an unknown/empty stage go into a trailing group so nothing
  // is hidden.
  for (const [key, stageDeals] of byStage) {
    groups.push({
      key: key || "unknown",
      label: key || fallbackLabel,
      deals: stageDeals,
    });
  }
  return groups;
};

const DealsLayoutMobile = ({
  attentionPipeline = false,
  dashboardSelection,
  hideHeader = false,
}: {
  attentionPipeline?: boolean;
  dashboardSelection?: DashboardDealSelection;
  hideHeader?: boolean;
}) => {
  const translate = useTranslate();
  const location = useLocation();
  const { dealStages } = useConfigurationContext();
  const { data, error, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [taskDeal, setTaskDeal] = useState<Deal | null>(null);
  const [recentMove, setRecentMove] = useState<{
    deal: Deal;
    destinationStage: string;
  } | null>(null);
  const { data: tasks = [] } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "due_date", order: "ASC" },
    filter: {},
  });
  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);

  // The deal detail is a URL-driven dialog (same pattern as the desktop board):
  // tapping a row navigates to /deals/:id/show, which this list matches and
  // opens over itself; closing redirects back to the list.
  const matchShow = dashboardSelection
    ? null
    : matchPath("/deals/:id/show", location.pathname);
  const detailBasePath = dashboardSelection
    ? getDashboardDealSelectionPath(dashboardSelection.kind)
    : undefined;
  const dashboardReturnPath = detailBasePath
    ? getDashboardDealReturnPath(detailBasePath, location.search)
    : undefined;
  const dashboardDealId = dashboardSelection
    ? new URLSearchParams(location.search).get("deal")
    : null;

  const fallbackLabel = translate("resources.deals.other_stage", {
    _: "Overig",
  });
  const groups = useMemo(() => {
    const orderedDeals = attentionPipeline
      ? rankDealsForAttention(data ?? [], tasksByDeal).map(({ deal }) => deal)
      : (data ?? []);
    return groupDealsByStage(orderedDeals, dealStages, fallbackLabel);
  }, [attentionPipeline, data, dealStages, fallbackLabel, tasksByDeal]);

  const moveDealToStage = (deal: Deal, destinationStage: string) => {
    if (deal.stage === destinationStage) return;
    persistDealStageMove(
      deal,
      { stage: destinationStage, index: undefined },
      dataProvider,
    )
      .then(() => {
        setRecentMove({ deal, destinationStage });
        refetch();
      })
      .catch((moveError) => {
        console.error("Failed to persist the mobile deal move:", moveError);
        notify(
          moveError instanceof Error
            ? moveError.message
            : "resources.deals.move_error",
          { type: "error" },
        );
        refetch();
      });
  };

  return (
    <div>
      <DealShow
        closeTo={dashboardReturnPath ?? "/deals"}
        open={dashboardSelection ? !!dashboardDealId : !!matchShow}
        id={dashboardDealId ?? matchShow?.params.id}
      />
      <TaskCreateSheet
        open={taskDeal != null}
        deal_id={taskDeal?.id}
        onOpenChange={(open) => {
          if (!open) setTaskDeal(null);
        }}
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
      {!hideHeader ? (
        <MobileHeader>
          <h1 className="text-lg font-semibold">
            {dashboardSelection?.label ??
              translate("resources.deals.name", { smart_count: 2 })}
          </h1>
        </MobileHeader>
      ) : null}
      <MobileContent>
        {isPending ? (
          <MobileDealsListSkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">
            {translate("ra.notification.http_error", {
              _: "Er ging iets mis bij het laden van de deals.",
            })}
          </p>
        ) : data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.deals.empty", { _: "Nog geen deals" })}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {!dashboardSelection && !attentionPipeline ? (
              <CompletionScopeInput className="self-start" />
            ) : null}
            <nav
              aria-label="Spring naar dealfase"
              className="sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto border-y bg-background/95 px-4 py-2 backdrop-blur"
            >
              {groups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs font-medium"
                  onClick={() =>
                    document
                      .getElementById(`deal-stage-${group.key}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {group.label} · {group.deals.length}
                </button>
              ))}
            </nav>
            {groups.map((group) => (
              <section
                id={`deal-stage-${group.key}`}
                key={group.key}
                className="flex scroll-mt-28 flex-col gap-2"
              >
                <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                  <span className="text-muted-foreground/70">
                    {group.deals.length}
                  </span>
                </h2>
                {group.deals.map((deal) => (
                  <RecordContextProvider key={deal.id} value={deal}>
                    <MobileDealRow
                      attentionPipeline={attentionPipeline}
                      deal={deal}
                      detailBasePath={dashboardReturnPath}
                      openTasks={tasksByDeal.get(deal.id) ?? []}
                      onMoveToStage={
                        attentionPipeline ? moveDealToStage : undefined
                      }
                      onPlanTask={setTaskDeal}
                    />
                  </RecordContextProvider>
                ))}
              </section>
            ))}
          </div>
        )}
      </MobileContent>
    </div>
  );
};

const MobileDealsListSkeleton = () => (
  <div className="flex flex-col gap-6">
    {Array.from({ length: 3 }).map((_, groupIndex) => (
      <div key={groupIndex} className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <Skeleton key={rowIndex} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    ))}
  </div>
);

const MobileDealRow = ({
  attentionPipeline = false,
  deal,
  detailBasePath,
  openTasks,
  onMoveToStage,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  deal: Deal;
  detailBasePath?: string;
  openTasks: Task[];
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
}) => {
  const { currency } = useConfigurationContext();
  const workflow = getDealWorkflow(deal, openTasks);
  const attentionAccent =
    workflow.kind === "overdue"
      ? "border-l-destructive"
      : workflow.kind === "today"
        ? "border-l-amber-500"
        : workflow.kind === "overdue_closing"
          ? "border-l-orange-500"
          : "border-l-violet-500";
  return (
    <Card
      className={cn(
        "flex flex-col gap-1.5 p-3 transition-colors hover:bg-muted/60",
        attentionPipeline && "border-l-4",
        attentionPipeline && attentionAccent,
      )}
    >
      <Link
        to={
          detailBasePath
            ? getDashboardDealDetailPath(detailBasePath, deal.id)
            : `/deals/${deal.id}/show`
        }
        className="flex flex-col gap-1.5 no-underline"
      >
        <div className="flex items-center gap-2">
          <ReferenceField
            source="company_id"
            reference="companies"
            link={false}
          >
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>
          <span className="text-sm font-medium flex-1 truncate">
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            />
            {" - "}
            {deal.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            <NumberField
              source="amount"
              options={{
                notation: "compact",
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
                minimumSignificantDigits: 3,
              }}
              locales="nl-NL"
              // NumberField translates a string `empty` prop as an i18n key.
              empty="resources.deals.no_amount"
            />
          </span>
          <AssigneesField
            ids={deal.assignee_ids}
            size={16}
            className="text-xs text-muted-foreground"
          />
        </div>
      </Link>
      <DealWorkflowIndicator
        deal={deal}
        openTasks={openTasks}
        onPlanTask={onPlanTask ? () => onPlanTask(deal) : undefined}
      />
      {attentionPipeline && onMoveToStage && onPlanTask ? (
        <AttentionDealActions
          compact
          deal={deal}
          onMoveToStage={onMoveToStage}
          onPlanTask={onPlanTask}
        />
      ) : null}
    </Card>
  );
};
