import { useTranslate } from "ra-core";

import { TasksListByDueDate } from "./TasksListByDueDate";

// We work as individuals, not as a team, so the task list is always scoped to
// the signed-in user ("Mijn taken"). The former mine/team toggle was removed.
export const TasksListContent = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <TasksListByDueDate
        scope="mine"
        emptyPlaceholder={
          <p className="text-sm">
            {translate("resources.tasks.empty_list_hint")}
          </p>
        }
      />
    </div>
  );
};
