import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ListTodo,
} from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { DealWorkflowBadge } from "../deals/DealWorkflowIndicator";
import {
  DEAL_ATTENTION_PATH,
  getDashboardDealDetailPath,
} from "../deals/dashboardDealSelection";
import { SectionHeader } from "../layout/SectionHeader";
import {
  buildOpenTasksByDeal,
  rankDealsForAttention,
  summarizeDealAttention,
  type DealAttentionCounts,
} from "../deals/dealWorkflow";
import type { Deal, Task as TaskRecord } from "../types";

const PAGE_SIZE = 8;

export const DealActionQueue = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
  );
  const { data: tasks = [], isPending: tasksPending } = useGetList<TaskRecord>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );

  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);
  const rankedDeals = useMemo(
    () => rankDealsForAttention(deals, tasksByDeal),
    [deals, tasksByDeal],
  );
  const visibleDeals = rankedDeals.slice(0, PAGE_SIZE);
  const attentionCounts = useMemo(
    () => summarizeDealAttention(rankedDeals),
    [rankedDeals],
  );

  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title={translate("crm.dashboard.deal_actions.title", {
          _: "Dit heeft uw aandacht nodig",
        })}
        count={attentionCounts.total || undefined}
        meta={translate("crm.dashboard.deal_actions.subtitle", {
          _: "Alleen afwijkingen: te laat, vandaag, verlopen of nog niet gepland.",
        })}
        to={DEAL_ATTENTION_PATH}
        toLabel={translate("crm.dashboard.deal_actions.open_board", {
          _: "Alles bekijken",
        })}
      />

      {!dealsPending && !tasksPending && attentionCounts.total > 0 ? (
        <AttentionSummary counts={attentionCounts} />
      ) : null}

      <div className="panel divide-y divide-line-subtle overflow-hidden">
        {dealsPending || tasksPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="flex items-start gap-3 p-5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-live" />
            <div>
              <p className="text-body font-medium text-ink">
                {translate("crm.dashboard.deal_actions.empty_title", {
                  _: "Alles onder controle",
                })}
              </p>
              <p className="text-meta text-ink-3">
                {translate("crm.dashboard.deal_actions.empty", {
                  _: "Er zijn geen achterstallige of ongeplande opdrachten.",
                })}
              </p>
            </div>
          </div>
        ) : (
          visibleDeals.map(({ deal, workflow }) => (
            <RecordContextProvider key={deal.id} value={deal}>
              {/* Three zones on one line: who it is for, what the next step is,
                  and what state it is in. Stacking the step underneath left a
                  hole in the middle of the row on a wide screen. */}
              <div
                className={cn(
                  "flex min-w-0 items-center gap-3 border-l-2 border-l-transparent px-3 py-2",
                  workflow.kind === "overdue" && "border-l-late",
                  workflow.kind === "today" && "border-l-wait",
                )}
              >
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                >
                  <CompanyAvatar width={20} height={20} />
                </ReferenceField>
                <Link
                  to={getDashboardDealDetailPath(DEAL_ATTENTION_PATH, deal.id)}
                  className="min-w-0 flex-[3] no-underline hover:underline"
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
                <p className="hidden min-w-0 flex-[4] items-center gap-1.5 text-meta text-ink-2 sm:flex">
                  <ListTodo className="size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 truncate">
                    {workflow.nextTask
                      ? workflow.nextTask.text
                      : translate(`resources.deals.next_action.${deal.stage}`, {
                          _: translate("resources.deals.workflow.plan_next", {
                            _: "Plan volgende stap",
                          }),
                        })}
                  </span>
                </p>
                <DealWorkflowBadge workflow={workflow} />
              </div>
            </RecordContextProvider>
          ))
        )}
      </div>

      {!dealsPending && rankedDeals.length > PAGE_SIZE ? (
        <Link
          to={DEAL_ATTENTION_PATH}
          className="self-end text-meta text-ink-3 no-underline hover:text-ink"
        >
          {translate("crm.dashboard.deal_actions.more", {
            count: rankedDeals.length - PAGE_SIZE,
            _: `Nog ${rankedDeals.length - PAGE_SIZE} aandachtspunten`,
          })}
        </Link>
      ) : null}
    </section>
  );
};

const AttentionSummary = ({ counts }: { counts: DealAttentionCounts }) => {
  const translate = useTranslate();
  const items = [
    counts.overdue
      ? {
          className: "border-late/35 bg-late-tint text-late",
          icon: CircleAlert,
          key: "overdue",
          label: translate("crm.dashboard.deal_actions.counts.overdue", {
            count: counts.overdue,
            _: `${counts.overdue} te laat`,
          }),
        }
      : null,
    counts.today
      ? {
          className: "border-wait/35 bg-wait-tint text-wait",
          icon: CalendarClock,
          key: "today",
          label: translate("crm.dashboard.deal_actions.counts.today", {
            count: counts.today,
            _: `${counts.today} vandaag`,
          }),
        }
      : null,
    counts.planning
      ? {
          className: "border-line text-ink-2",
          icon: CalendarClock,
          key: "planning",
          label: translate("crm.dashboard.deal_actions.counts.planning", {
            count: counts.planning,
            _: `${counts.planning} planning verlopen`,
          }),
        }
      : null,
    counts.unplanned
      ? {
          className: "border-line text-ink-3",
          icon: ListTodo,
          key: "unplanned",
          label: translate("crm.dashboard.deal_actions.counts.unplanned", {
            count: counts.unplanned,
            _: `${counts.unplanned} zonder planning`,
          }),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <div
      className="flex flex-wrap gap-2"
      aria-label={translate("crm.dashboard.deal_actions.summary", {
        _: "Samenvatting aandachtspunten",
      })}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.key}
            className={cn(
              "num inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-meta font-medium",
              item.className,
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
          </span>
        );
      })}
    </div>
  );
};
