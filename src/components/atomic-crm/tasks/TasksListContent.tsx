import { useTranslate } from "ra-core";

import { TasksListByDueDate } from "./TasksListByDueDate";
import { TasksToClaim } from "./TasksToClaim";

// We work as individuals, not as a team, so the personal list is always scoped
// to the signed-in user ("Mijn taken"; the former mine/team toggle was removed).
// Below it, any unassigned Trello-synced steps show up so they can be picked up.
export const TasksListContent = ({
  compact = false,
}: {
  compact?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-6">
      <TasksListByDueDate
        scope="mine"
        limit={compact ? 5 : undefined}
        emptyPlaceholder={
          <p className="text-sm">
            {translate("resources.tasks.empty_list_hint")}
          </p>
        }
      />
      <TasksToClaim limit={compact ? 3 : undefined} />
    </div>
  );
};
