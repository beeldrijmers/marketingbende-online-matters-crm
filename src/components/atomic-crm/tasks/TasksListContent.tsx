import { useState } from "react";
import { useTranslate } from "ra-core";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { TasksListByDueDate } from "./TasksListByDueDate";

type TaskScope = "mine" | "all";

export const TasksListContent = () => {
  const translate = useTranslate();
  const [scope, setScope] = useState<TaskScope>("mine");

  const handleScopeChange = (value: string) => {
    if (value === "mine" || value === "all") {
      setScope(value);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={scope}
        onValueChange={handleScopeChange}
        variant="outline"
        size="sm"
        className="self-start"
      >
        <ToggleGroupItem value="mine">
          {translate("resources.tasks.filters.mine", { _: "Mijn taken" })}
        </ToggleGroupItem>
        <ToggleGroupItem value="all">
          {translate("resources.tasks.filters.team", { _: "Team" })}
        </ToggleGroupItem>
      </ToggleGroup>
      <TasksListByDueDate
        scope={scope}
        emptyPlaceholder={
          <p className="text-sm">
            {translate("resources.tasks.empty_list_hint")}
          </p>
        }
      />
    </div>
  );
};
