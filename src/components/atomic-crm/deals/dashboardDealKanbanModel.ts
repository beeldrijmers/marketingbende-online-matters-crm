import { getBillingState } from "../dashboard/billingQueueModel";
import type { Identifier } from "ra-core";

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

const attentionPipelineFilters: readonly AttentionPipelineFilter[] = [
  "all",
  "overdue",
  "today",
  "planning",
  "unplanned",
];

export const parseAttentionPipelineFilter = (
  value: string | null,
): AttentionPipelineFilter =>
  attentionPipelineFilters.includes(value as AttentionPipelineFilter)
    ? (value as AttentionPipelineFilter)
    : "all";

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

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("nl-NL");

export const filterAttentionDealsBySearch = (
  rankedDeals: RankedDealWorkflow[],
  search: string,
  companyNames: ReadonlyMap<Identifier, string> = new Map(),
) => {
  const searchTerms = normalizeSearchText(search).trim().split(/\s+/);
  if (searchTerms.length === 1 && searchTerms[0] === "") return rankedDeals;

  return rankedDeals.filter(({ deal }) => {
    const haystack = normalizeSearchText(
      [deal.name, deal.description, companyNames.get(deal.company_id)]
        .filter(Boolean)
        .join(" "),
    );
    return searchTerms.every((term) => haystack.includes(term));
  });
};

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
