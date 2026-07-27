import type { Identifier } from "ra-core";

import {
  buildOpenTasksByDeal,
  getDealWorkflow,
  needsDealAttention,
  type DealAttentionCounts,
} from "../deals/dealWorkflow";
import type { Deal, Task } from "../types";

/**
 * "Wie doet wat": the open work, split by the person who owns it.
 *
 * John and Rick used to read this off a Trello board — one glance told them who
 * was carrying what and which cards nobody had picked up. The CRM knew all of
 * it and showed none of it, so this rebuilds that glance from the deal owner,
 * and keeps the unclaimed work visible instead of letting it sink to the
 * bottom of a list.
 */

/** A deal is finished once it reaches "won", same rule as the board's scope. */
const isOpenDeal = (deal: Deal) =>
  deal.stage !== "won" && deal.archived_at == null;

const EMPTY_COUNTS: DealAttentionCounts = {
  overdue: 0,
  planning: 0,
  stalled: 0,
  today: 0,
  total: 0,
  unplanned: 0,
};

export type TeamWorkloadRow = {
  /**
   * Recurring and one-off value are kept apart. A single "€ in werkstroom"
   * figure added €300-per-month to a €5.000 project and produced a number that
   * means nothing — the same mistake the board's column totals used to make.
   */
  monthlyAmount: number;
  oneOffAmount: number;
  /** How much of their work is off-track, by kind. */
  attention: DealAttentionCounts;
  /** Open deals owned. */
  open: number;
  /** null means: nobody owns these. */
  salesId: Identifier | null;
};

const countWorkflow = (
  counts: DealAttentionCounts,
  kind: string,
): DealAttentionCounts => ({
  overdue: counts.overdue + (kind === "overdue" ? 1 : 0),
  planning:
    counts.planning +
    (kind === "overdue_closing" || kind === "proposal_expired" ? 1 : 0),
  stalled: counts.stalled + (kind === "stalled" ? 1 : 0),
  today: counts.today + (kind === "today" ? 1 : 0),
  total: counts.total + 1,
  unplanned:
    counts.unplanned + (kind === "missing" || kind === "unscheduled" ? 1 : 0),
});

/**
 * Rows are ordered by how much needs a person, then by volume. The unowned row
 * always sorts last: it is a gap to close, not a colleague to compare against.
 */
export const buildTeamWorkload = (
  deals: Deal[],
  tasks: Task[],
  now: Date = new Date(),
): TeamWorkloadRow[] => {
  const tasksByDeal = buildOpenTasksByDeal(tasks);

  // The map is local to this call and never escapes: every row it holds is
  // replaced with a new object rather than edited in place.
  const byOwner = new Map<string, TeamWorkloadRow>();

  for (const deal of deals.filter(isOpenDeal)) {
    const key = deal.sales_id == null ? "" : String(deal.sales_id);
    const current = byOwner.get(key) ?? {
      attention: EMPTY_COUNTS,
      monthlyAmount: 0,
      oneOffAmount: 0,
      open: 0,
      salesId: deal.sales_id ?? null,
    };
    const workflow = getDealWorkflow(deal, tasksByDeal.get(deal.id) ?? [], now);
    const amount = deal.amount ?? 0;
    const recurring = deal.revenue_period === "maandelijks";

    byOwner.set(key, {
      ...current,
      attention: needsDealAttention(workflow)
        ? countWorkflow(current.attention, workflow.kind)
        : current.attention,
      monthlyAmount: current.monthlyAmount + (recurring ? amount : 0),
      oneOffAmount: current.oneOffAmount + (recurring ? 0 : amount),
      open: current.open + 1,
    });
  }

  return [...byOwner.values()].sort((left, right) => {
    if (left.salesId == null) return 1;
    if (right.salesId == null) return -1;
    if (right.attention.total !== left.attention.total) {
      return right.attention.total - left.attention.total;
    }
    return right.open - left.open;
  });
};
