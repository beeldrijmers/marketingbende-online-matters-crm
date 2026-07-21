import { CheckSquare } from "lucide-react";
import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  const translate = useTranslate();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <CheckSquare className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground flex-1">
          {translate("crm.dashboard.upcoming_tasks", {
            _: "Aankomende taken",
          })}
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-4">
        <TasksListContent compact />
      </Card>
    </div>
  );
};
