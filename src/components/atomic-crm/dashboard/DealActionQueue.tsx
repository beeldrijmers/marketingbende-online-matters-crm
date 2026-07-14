import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { DealWorkflowBadge } from "../deals/DealWorkflowIndicator";
import {
  buildOpenTasksByDeal,
  rankDealsForAttention,
} from "../deals/dealWorkflow";
import { Task } from "../tasks/Task";
import type { Deal, Task as TaskRecord } from "../types";

const PAGE_SIZE = 6;

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

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <BriefcaseBusiness className="size-6 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            {translate("crm.dashboard.deal_actions.title", {
              _: "Af te handelen",
            })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {translate("crm.dashboard.deal_actions.subtitle", {
              _: "De belangrijkste volgende stappen uit uw kanban.",
            })}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to="/deals">
            {translate("crm.dashboard.deal_actions.open_board", {
              _: "Kanban",
            })}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <Card className="divide-y overflow-hidden py-0">
        {dealsPending || tasksPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleDeals.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {translate("crm.dashboard.deal_actions.empty", {
              _: "Er zijn geen open deals om af te handelen.",
            })}
          </p>
        ) : (
          visibleDeals.map(({ deal, workflow }) => (
            <RecordContextProvider key={deal.id} value={deal}>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <CompanyAvatar width={20} height={20} />
                  </ReferenceField>
                  <Link
                    to={`/deals/${deal.id}/show`}
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
                  <Task task={workflow.nextTask} showContact={false} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {translate(`resources.deals.next_action.${deal.stage}`, {
                      _: translate("resources.deals.workflow.plan_next", {
                        _: "Plan volgende stap",
                      }),
                    })}
                  </p>
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
            _: `Nog ${rankedDeals.length - PAGE_SIZE} op het kanbanbord`,
          })}
        </p>
      ) : null}
    </section>
  );
};
