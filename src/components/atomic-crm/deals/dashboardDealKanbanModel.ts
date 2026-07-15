import { getBillingState } from "../dashboard/billingQueueModel";
import type { Deal, Task } from "../types";
import {
  buildOpenTasksByDeal,
  rankDealsForAttention,
  type RankedDealWorkflow,
} from "./dealWorkflow";

export type AttentionPipelineFilter =
  | "all"
  | "overdue"
  | "today"
  | "planning"
  | "unplanned";

export const selectAttentionDeals = (
  deals: Deal[],
  tasks: Task[],
  now: Date = new Date(),
) => rankDealsForAttention(deals, buildOpenTasksByDeal(tasks), now);

export const matchesAttentionPipelineFilter = (
  rankedDeal: RankedDealWorkflow,
  filter: AttentionPipelineFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "overdue") return rankedDeal.workflow.kind === "overdue";
  if (filter === "today") return rankedDeal.workflow.kind === "today";
  if (filter === "planning")
    return rankedDeal.workflow.kind === "overdue_closing";
  return (
    rankedDeal.workflow.kind === "missing" ||
    rankedDeal.workflow.kind === "unscheduled"
  );
};

export const filterAttentionDeals = (
  rankedDeals: RankedDealWorkflow[],
  filter: AttentionPipelineFilter,
) => rankedDeals.filter((deal) => matchesAttentionPipelineFilter(deal, filter));

export const selectAttentionDealIds = (
  deals: Deal[],
  tasks: Task[],
  filter: AttentionPipelineFilter = "all",
  now: Date = new Date(),
) => {
  const ids: Deal["id"][] = [];
  for (const rankedDeal of selectAttentionDeals(deals, tasks, now)) {
    if (matchesAttentionPipelineFilter(rankedDeal, filter)) {
      ids.push(rankedDeal.deal.id);
    }
  }
  return ids;
};

export const selectBillingDealIds = (deals: Deal[]) => {
  const ids: Deal["id"][] = [];
  for (const deal of deals) {
    if (deal.stage === "facturatie-live" && getBillingState(deal) != null) {
      ids.push(deal.id);
    }
  }
  return ids;
};
