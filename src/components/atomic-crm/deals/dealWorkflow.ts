import type { Identifier } from "ra-core";

import type { Deal, Task } from "../types";

export type DealWorkflowKind =
  | "overdue"
  | "today"
  | "scheduled"
  | "unscheduled"
  | "overdue_closing"
  | "missing"
  | "on_hold"
  | "complete";

export type DealWorkflow = {
  kind: DealWorkflowKind;
  nextTask: Task | null;
  openTaskCount: number;
};

const dayKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
};

const localTodayKey = (now: Date): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const compareTasks = (left: Task, right: Task): number => {
  const leftDue = dayKey(left.due_date);
  const rightDue = dayKey(right.due_date);
  if (leftDue && rightDue) return leftDue.localeCompare(rightDue);
  if (leftDue) return -1;
  if (rightDue) return 1;
  return String(left.id).localeCompare(String(right.id));
};

export const buildOpenTasksByDeal = (
  tasks: Task[],
): Map<Identifier, Task[]> => {
  const result = new Map<Identifier, Task[]>();

  for (const task of tasks) {
    if (task.done_date || task.deal_id == null) continue;
    const existing = result.get(task.deal_id);
    if (existing) existing.push(task);
    else result.set(task.deal_id, [task]);
  }

  for (const dealTasks of result.values()) {
    dealTasks.sort(compareTasks);
  }

  return result;
};

export const getDealWorkflow = (
  deal: Deal,
  openTasks: Task[] = [],
  now: Date = new Date(),
): DealWorkflow => {
  if (deal.stage === "won") {
    return { kind: "complete", nextTask: null, openTaskCount: 0 };
  }

  const sortedTasks = [...openTasks].filter((task) => !task.done_date);
  sortedTasks.sort(compareTasks);
  const nextTask = sortedTasks[0] ?? null;
  const today = localTodayKey(now);

  if (nextTask) {
    const due = dayKey(nextTask.due_date);
    const kind: DealWorkflowKind = !due
      ? "unscheduled"
      : due < today
        ? "overdue"
        : due === today
          ? "today"
          : "scheduled";
    return { kind, nextTask, openTaskCount: sortedTasks.length };
  }

  if (deal.on_hold || deal.stage === "on-hold") {
    return { kind: "on_hold", nextTask: null, openTaskCount: 0 };
  }

  const closingDate = dayKey(deal.expected_closing_date);
  if (closingDate && closingDate < today) {
    return { kind: "overdue_closing", nextTask: null, openTaskCount: 0 };
  }

  return { kind: "missing", nextTask: null, openTaskCount: 0 };
};

const workflowPriority: Record<DealWorkflowKind, number> = {
  overdue: 0,
  today: 1,
  overdue_closing: 2,
  missing: 3,
  unscheduled: 4,
  scheduled: 5,
  on_hold: 6,
  complete: 7,
};

export type RankedDealWorkflow = {
  deal: Deal;
  workflow: DealWorkflow;
};

export const rankDealsForAttention = (
  deals: Deal[],
  tasksByDeal: Map<Identifier, Task[]>,
  now: Date = new Date(),
): RankedDealWorkflow[] =>
  deals
    .map((deal) => ({
      deal,
      workflow: getDealWorkflow(deal, tasksByDeal.get(deal.id) ?? [], now),
    }))
    .filter(({ workflow }) => workflow.kind !== "complete")
    .sort((left, right) => {
      const priority =
        workflowPriority[left.workflow.kind] -
        workflowPriority[right.workflow.kind];
      if (priority !== 0) return priority;

      const leftDue = dayKey(
        left.workflow.nextTask?.due_date ??
          left.deal.expected_closing_date ??
          left.deal.updated_at,
      );
      const rightDue = dayKey(
        right.workflow.nextTask?.due_date ??
          right.deal.expected_closing_date ??
          right.deal.updated_at,
      );
      return (leftDue ?? "9999-12-31").localeCompare(rightDue ?? "9999-12-31");
    });
