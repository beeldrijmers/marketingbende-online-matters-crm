import { useGetIdentity, useGetList } from "ra-core";
import { useMemo } from "react";

import { selectAttentionDeals } from "../deals/dashboardDealKanbanModel";
import type { Deal, Task } from "../types";
import type { NavBadge } from "./navigation";

const EMPTY_COUNTS: Record<NavBadge, number> = {
  attention: 0,
  "tasks-overdue": 0,
  "to-invoice": 0,
};

/**
 * Counters behind the navigation labels: how much work is actually waiting.
 *
 * These reuse the exact queries the board and the task list already run, so
 * React Query serves them from cache instead of adding round-trips — the point
 * is that the rail answers "waar staan we?" before you click anything.
 */
export const useNavigationCounts = (): Record<NavBadge, number> => {
  const { identity } = useGetIdentity();
  // Same query keys as the board and the task list, so this reuses their cache
  // instead of adding round-trips. The rail is ambient information: it never
  // triggers a refetch of its own, it just reads what is already there.
  const ambient = {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  } as const;
  const { data: deals } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
    ambient,
  );
  const { data: tasks } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
    ambient,
  );

  return useMemo(() => {
    if (!deals) return EMPTY_COUNTS;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const openTasks = (tasks ?? []).filter((task) => !task.done_date);

    return {
      attention: selectAttentionDeals(deals, tasks ?? [], today).length,
      "tasks-overdue": openTasks.filter(
        (task) =>
          task.due_date != null &&
          task.due_date.slice(0, 10) <= todayKey &&
          (identity?.id == null ||
            task.sales_id == null ||
            String(task.sales_id) === String(identity.id)),
      ).length,
      "to-invoice": deals.filter((deal) => deal.stage === "facturatie-live")
        .length,
    };
  }, [deals, identity?.id, tasks]);
};
