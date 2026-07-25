import { AlertTriangle, CalendarClock, Clock3, ListTodo } from "lucide-react";
import { RecordContextProvider, useTranslate } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { AssigneesField } from "../sales/AssigneesField";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { AttentionDealActions } from "./AttentionDealActions";
import { getDashboardDealDetailPath } from "./dashboardDealSelection";
import { formatISODateString } from "./dealUtils";
import type { DealWorkflowKind, RankedDealWorkflow } from "./dealWorkflow";

/**
 * The attention view is a queue, not a board.
 *
 * Ranking deals by urgency and then scattering them over eight stage columns
 * destroyed the ranking: the most urgent item could sit in the fifth column,
 * below the fold. One dense list keeps the order that the ranking computed, with
 * the urgency groups as sticky headings.
 */
const GROUPS: {
  kinds: DealWorkflowKind[];
  labelKey: string;
  fallback: string;
  icon: typeof AlertTriangle;
  tone: string;
}[] = [
  {
    kinds: ["overdue"],
    labelKey: "resources.deals.workflow.overdue",
    fallback: "Te laat",
    icon: AlertTriangle,
    tone: "text-late",
  },
  {
    kinds: ["today"],
    labelKey: "resources.deals.workflow.today",
    fallback: "Vandaag",
    icon: Clock3,
    tone: "text-wait",
  },
  {
    kinds: ["overdue_closing"],
    labelKey: "resources.deals.workflow.plan_overdue",
    fallback: "Planning verlopen",
    icon: CalendarClock,
    tone: "text-ink-2",
  },
  {
    kinds: ["missing", "unscheduled"],
    labelKey: "resources.deals.attention.unplanned",
    fallback: "Niet gepland",
    icon: ListTodo,
    tone: "text-ink-2",
  },
];

export const AttentionList = ({
  detailBasePath,
  onMoveToStage,
  onPlanTask,
  rankedDeals,
}: {
  detailBasePath?: string;
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
  rankedDeals: RankedDealWorkflow[];
}) => {
  const translate = useTranslate();
  const groups = GROUPS.map((group) => ({
    ...group,
    items: rankedDeals.filter((ranked) =>
      group.kinds.includes(ranked.workflow.kind),
    ),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="panel flex items-center justify-center p-8 text-body text-ink-2">
        {translate("crm.dashboard.deal_actions.empty", {
          _: "Er zijn geen achterstallige of ongeplande opdrachten.",
        })}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="panel overflow-hidden">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.labelKey}>
              <h3 className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line-subtle bg-sunken px-3 py-1.5">
                <Icon className={cn("size-3.5 shrink-0", group.tone)} />
                <span className="eyebrow text-ink-2">
                  {translate(group.labelKey, { _: group.fallback })}
                </span>
                <span className="num text-eyebrow tracking-normal text-ink-3">
                  {group.items.length}
                </span>
              </h3>
              {group.items.map(({ deal, workflow }) => (
                <AttentionRow
                  key={deal.id}
                  deal={deal}
                  detailBasePath={detailBasePath}
                  onMoveToStage={onMoveToStage}
                  onPlanTask={onPlanTask}
                  workflow={workflow}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const AttentionRow = ({
  deal,
  detailBasePath,
  onMoveToStage,
  onPlanTask,
  workflow,
}: {
  deal: Deal;
  detailBasePath?: string;
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
  workflow: RankedDealWorkflow["workflow"];
}) => {
  const translate = useTranslate();
  const { currency, dealStages } = useConfigurationContext();
  const detailPath = detailBasePath
    ? getDashboardDealDetailPath(detailBasePath, deal.id)
    : `/deals/${deal.id}/show`;
  const stageLabel = dealStages.find(
    (stage) => stage.value === deal.stage,
  )?.label;
  const nextTask = workflow.nextTask;
  const due = nextTask?.due_date
    ? formatISODateString(nextTask.due_date.slice(0, 10))
    : deal.expected_closing_date
      ? formatISODateString(deal.expected_closing_date.slice(0, 10))
      : null;

  return (
    <RecordContextProvider value={deal}>
      <div className="group/row flex min-w-0 items-center gap-3 border-b border-line-subtle px-3 py-2 last:border-0 hover:bg-sunken">
        <ReferenceField source="company_id" reference="companies" link={false}>
          <CompanyAvatar width={20} height={20} />
        </ReferenceField>
        <Link
          to={detailPath}
          className="min-w-0 flex-1 no-underline focus-visible:outline-none"
        >
          <span className="block truncate text-body font-semibold text-ink">
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
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <span className="truncate text-meta text-ink-2">
            {nextTask
              ? nextTask.text
              : translate(`resources.deals.next_action.${deal.stage}`, {
                  _: translate("resources.deals.workflow.plan_next", {
                    _: "Plan volgende stap",
                  }),
                })}
          </span>
          <span className="num truncate text-meta text-ink-3">
            {[stageLabel, due].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className="num hidden w-24 shrink-0 text-right text-body font-semibold text-ink sm:block">
          {deal.amount
            ? deal.amount.toLocaleString("nl-NL", {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              })
            : null}
        </span>
        <AssigneesField
          ids={deal.assignee_ids}
          size={20}
          showParties={false}
          className="hidden shrink-0 lg:flex"
        />
        {onMoveToStage && onPlanTask ? (
          // Row actions stay out of the way until the row is hovered or focused:
          // 28 rows x 2 buttons is a wall of chrome that competes with the data.
          <div className="shrink-0 opacity-0 transition-opacity duration-1 focus-within:opacity-100 group-hover/row:opacity-100">
            <AttentionDealActions
              compact
              deal={deal}
              onMoveToStage={onMoveToStage}
              onPlanTask={onPlanTask}
            />
          </div>
        ) : null}
      </div>
    </RecordContextProvider>
  );
};
