import { CheckSquare } from "lucide-react";
import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { AddTask } from "../tasks/AddTask";
import { TasksListContent } from "../tasks/TasksListContent";

export const TasksList = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <CheckSquare className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground flex-1">
          {translate("crm.dashboard.upcoming_tasks", {
            _: "Upcoming Tasks",
          })}
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-6">
        <TasksListContent />
      </Card>
    </div>
  );
};
