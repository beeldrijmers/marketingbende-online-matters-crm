import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useTranslate,
} from "ra-core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { TasksIterator } from "./TasksIterator";

type TaskListProps = {
  tasks: any[];
  title: string;
  showContact?: boolean;
  isMobile: boolean;
  count?: number;
  urgent?: boolean;
};

export const TaskListFilter = ({
  tasks,
  title,
  showContact,
  isMobile,
  count,
  urgent,
}: TaskListProps) => {
  const translate = useTranslate();
  const listContext = useList({
    data: tasks,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!tasks?.length || !total) return null;

  const isUrgent = !!urgent && (count ?? 0) > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-2">
        <p
          className={cn(
            "text-xs uppercase tracking-wider font-medium",
            isUrgent ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {title}
        </p>
        {count != null && count > 0 && (
          <Badge
            variant={isUrgent ? "destructive" : "secondary"}
            className="h-4 min-w-4 px-1 text-[10px] leading-none"
          >
            {count}
          </Badge>
        )}
      </div>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={showContact} />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <a
            href="#"
            onClick={(e) => {
              listContext.setPerPage(listContext.perPage + 10);
              e.preventDefault();
            }}
            className="text-sm underline hover:no-underline"
          >
            {translate("crm.common.load_more")}
          </a>
        </div>
      )}
    </div>
  );
};
