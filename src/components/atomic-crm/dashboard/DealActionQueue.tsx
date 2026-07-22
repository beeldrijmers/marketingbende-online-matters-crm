import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ListTodo,
} from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { DealWorkflowBadge } from "../deals/DealWorkflowIndicator";
import {
  DEAL_ATTENTION_PATH,
  getDashboardDealDetailPath,
} from "../deals/dashboardDealSelection";
import {
  buildOpenTasksByDeal,
  rankDealsForAttention,
  summarizeDealAttention,
  type DealAttentionCounts,
} from "../deals/dealWorkflow";
import { Task } from "../tasks/Task";
import type { Deal, Task as TaskRecord } from "../types";

const PAGE_SIZE = 3;

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
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <BriefcaseBusiness className="size-6 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            {translate("crm.dashboard.deal_actions.title", {
              _: "Dit heeft je aandacht nodig",
            })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {translate("crm.dashboard.deal_actions.subtitle", {
              _: "Alleen afwijkingen: te laat, vandaag, verlopen of nog niet gepland.",
            })}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to={DEAL_ATTENTION_PATH}>
            {translate("crm.dashboard.deal_actions.open_board", {
              _: "Werkbord",
            })}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {!dealsPending && !tasksPending && attentionCounts.total > 0 ? (
        <AttentionSummary counts={attentionCounts} />
      ) : null}

      <Card className="divide-y overflow-hidden py-0">
        {dealsPending || tasksPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="flex items-start gap-3 bg-emerald-500/5 p-5">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {translate("crm.dashboard.deal_actions.empty_title", {
                  _: "Alles onder controle",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {translate("crm.dashboard.deal_actions.empty", {
                  _: "Er zijn geen achterstallige of ongeplande opdrachten.",
                })}
              </p>
            </div>
          </div>
        ) : (
          visibleDeals.map(({ deal, workflow }) => (
            <RecordContextProvider key={deal.id} value={deal}>
              <div
                className={cn(
                  "flex flex-col gap-2.5 border-l-2 border-l-transparent p-3.5",
                  workflow.kind === "overdue" && "border-l-destructive",
                  workflow.kind === "today" && "border-l-amber-500",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <CompanyAvatar width={20} height={20} />
                  </ReferenceField>
                  <Link
                    to={getDashboardDealDetailPath(
                      DEAL_ATTENTION_PATH,
                      deal.id,
                    )}
                    className="min-w-0 flex-1 no-underline hover:underline"
                  >
                    <span className="block truncate text-sm font-semibold">
                      <ReferenceField
                        source="company_id"
                        reference="companies"
                        link={false}
                      />
                      {" - "}
                      {deal.name}
                    </span>
                  </Link>
                  <DealWorkflowBadge workflow={workflow} />
                </div>

                {workflow.nextTask ? (
                  <div className="rounded-md bg-muted/35 px-3 py-2">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {translate("crm.dashboard.deal_actions.next_task", {
                        _: "Volgende taak",
                      })}
                    </p>
                    <Task task={workflow.nextTask} showContact={false} />
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md bg-muted/35 px-3 py-2">
                    <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {translate(
                          "crm.dashboard.deal_actions.recommended_action",
                          { _: "Aanbevolen volgende stap" },
                        )}
                      </p>
                      <p className="text-sm text-foreground">
                        {translate(
                          `resources.deals.next_action.${deal.stage}`,
                          {
                            _: translate("resources.deals.workflow.plan_next", {
                              _: "Plan volgende stap",
                            }),
                          },
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </RecordContextProvider>
          ))
        )}
      </Card>

      {!dealsPending && rankedDeals.length > PAGE_SIZE ? (
        <p className="text-right text-xs text-muted-foreground">
          {translate("crm.dashboard.deal_actions.more", {
            count: rankedDeals.length - PAGE_SIZE,
            _: `Nog ${rankedDeals.length - PAGE_SIZE} aandachtspunten op het kanbanbord`,
          })}
        </p>
      ) : null}
    </section>
  );
};

const AttentionSummary = ({ counts }: { counts: DealAttentionCounts }) => {
  const translate = useTranslate();
  const items = [
    counts.overdue
      ? {
          className: "border-destructive/30 bg-destructive/5 text-destructive",
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
          className:
            "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
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
          className:
            "border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-300",
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
          className: "border-border bg-muted/30 text-muted-foreground",
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
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
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
