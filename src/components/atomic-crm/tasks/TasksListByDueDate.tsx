import { useMemo } from "react";
import {
  type Identifier,
  useGetIdentity,
  useGetList,
  useTimeout,
  useTranslate,
} from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { TaskListFilter } from "./TasksListFilter";
import {
  isBeforeFriday,
  isDone,
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
  isRecentlyDone,
} from "./tasksPredicate";
import { isAutomaticTask } from "./taskSource";

export const TasksListByDueDate = ({
  filterByContact,
  scope = "mine",
  emptyPlaceholder,
  pendingPlaceholder,
  limit,
}: {
  filterByContact?: Identifier;
  scope?: "mine" | "all";
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
  limit?: number;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const translate = useTranslate();

  const scopeFilter =
    filterByContact != null
      ? { contact_id: filterByContact }
      : scope === "all"
        ? {}
        : { sales_id: identity?.id };

  const { data: tasks, isPending } = useGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: { ...scopeFilter },
    },
    {
      enabled: filterByContact != null || scope === "all" ? true : !!identity,
    },
  );

  const showContact = filterByContact == null;

  const ongoingTasks = useMemo(() => {
    // Auto rows are a deal-level safety net. They are rendered as the neutral
    // "Plan volgende stap" state on the deal itself, not as personal overdue
    // tasks with a made-up date.
    const ongoing =
      tasks?.filter(
        (task) =>
          (!isDone(task) || isRecentlyDone(task)) && !isAutomaticTask(task),
      ) || [];
    return limit == null ? ongoing : ongoing.slice(0, limit);
  }, [limit, tasks]);

  // Steps synced from Trello often have no due date. new Date(null) is 1970, so
  // without this guard those tasks would all be classed as "overdue"; instead
  // they get their own "Zonder datum" bucket.
  const overdueTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return task.due_date && isOverdue(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTodayTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return task.due_date && isDueToday(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTomorrowTasks = useMemo(
    () =>
      ongoingTasks?.filter(
        (task) => task.due_date && isDueTomorrow(task.due_date),
      ) || [],
    [ongoingTasks],
  );

  const dueThisWeekTasks = useMemo(
    () =>
      ongoingTasks?.filter(
        (task) => task.due_date && isDueThisWeek(task.due_date),
      ) || [],
    [ongoingTasks],
  );

  const dueLaterTasks = useMemo(
    () =>
      ongoingTasks?.filter(
        (task) => task.due_date && isDueLater(task.due_date),
      ) || [],
    [ongoingTasks],
  );

  const noDueDateTasks = useMemo(
    () => ongoingTasks?.filter((task) => !task.due_date) || [],
    [ongoingTasks],
  );

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  if (!ongoingTasks.length) {
    return emptyPlaceholder ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskListFilter
        tasks={overdueTasks}
        title={translate("resources.tasks.filters.overdue")}
        showContact={showContact}
        isMobile={isMobile}
        count={overdueTasks.length}
        urgent
      />
      <TaskListFilter
        tasks={dueTodayTasks}
        title={translate("resources.tasks.filters.today")}
        showContact={showContact}
        isMobile={isMobile}
        count={dueTodayTasks.length}
      />
      <TaskListFilter
        tasks={dueTomorrowTasks}
        title={translate("resources.tasks.filters.tomorrow")}
        showContact={showContact}
        isMobile={isMobile}
        count={dueTomorrowTasks.length}
      />
      {(!filterByContact || (filterByContact && isBeforeFriday())) && (
        <TaskListFilter
          tasks={dueThisWeekTasks}
          title={translate("resources.tasks.filters.this_week")}
          showContact={showContact}
          isMobile={isMobile}
          count={dueThisWeekTasks.length}
        />
      )}
      <TaskListFilter
        tasks={dueLaterTasks}
        title={translate("resources.tasks.filters.later")}
        showContact={showContact}
        isMobile={isMobile}
        count={dueLaterTasks.length}
      />
      <TaskListFilter
        tasks={noDueDateTasks}
        title={translate("resources.tasks.filters.no_due", {
          _: "Zonder datum",
        })}
        showContact={showContact}
        isMobile={isMobile}
        count={noDueDateTasks.length}
      />
    </div>
  );
};
