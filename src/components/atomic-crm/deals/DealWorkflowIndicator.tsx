import { CalendarClock, CircleAlert, Clock3, ListTodo } from "lucide-react";
import { useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Deal, Task } from "../types";
import { formatISODateString } from "./dealUtils";
import { getDealWorkflow, type DealWorkflow } from "./dealWorkflow";

const useWorkflowLabel = (workflow: DealWorkflow): string => {
  const translate = useTranslate();

  switch (workflow.kind) {
    case "overdue":
      return translate("resources.deals.workflow.overdue", { _: "Te laat" });
    case "today":
      return translate("resources.deals.workflow.today", { _: "Vandaag" });
    case "scheduled":
      return translate("resources.deals.workflow.next", { _: "Volgende" });
    case "unscheduled":
      return translate("resources.deals.workflow.next", { _: "Volgende" });
    case "overdue_closing":
      return translate("resources.deals.workflow.plan_overdue", {
        _: "Planning verlopen",
      });
    case "missing":
      return translate("resources.deals.workflow.plan_next", {
        _: "Plan volgende stap",
      });
    case "on_hold":
      return translate("resources.deals.fields.on_hold", { _: "In de wacht" });
    case "complete":
      return translate("resources.deals.workflow.complete", { _: "Klaar" });
  }
};

const WorkflowIcon = ({ workflow }: { workflow: DealWorkflow }) => {
  if (workflow.kind === "overdue" || workflow.kind === "overdue_closing") {
    return <CircleAlert className="size-3.5 shrink-0" />;
  }
  if (workflow.kind === "today") {
    return <Clock3 className="size-3.5 shrink-0" />;
  }
  if (workflow.kind === "scheduled") {
    return <CalendarClock className="size-3.5 shrink-0" />;
  }
  return <ListTodo className="size-3.5 shrink-0" />;
};

export const DealWorkflowBadge = ({ workflow }: { workflow: DealWorkflow }) => {
  const label = useWorkflowLabel(workflow);
  const urgent =
    workflow.kind === "overdue" || workflow.kind === "overdue_closing";

  return (
    <Badge
      variant={urgent ? "destructive" : "outline"}
      className={cn(
        "gap-1 px-1.5 py-0 text-[11px] font-medium",
        workflow.kind === "today" &&
          "border-amber-500/60 text-amber-700 dark:text-amber-300",
        workflow.kind === "missing" && "border-dashed text-muted-foreground",
      )}
    >
      <WorkflowIcon workflow={workflow} />
      {label}
    </Badge>
  );
};

export const DealWorkflowIndicator = ({
  deal,
  openTasks = [],
  className,
}: {
  deal: Deal;
  openTasks?: Task[];
  className?: string;
}) => {
  const translate = useTranslate();
  const workflow = getDealWorkflow(deal, openTasks);
  if (workflow.kind === "complete" || workflow.kind === "on_hold") return null;

  const nextTask = workflow.nextTask;
  const dueLabel = nextTask?.due_date
    ? formatISODateString(nextTask.due_date.slice(0, 10))
    : null;
  const remaining = Math.max(0, workflow.openTaskCount - 1);
  const urgent =
    workflow.kind === "overdue" || workflow.kind === "overdue_closing";

  return (
    <div
      className={cn(
        "mt-1 flex min-w-0 items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground",
        urgent && "bg-destructive/10 text-destructive dark:bg-destructive/15",
        workflow.kind === "today" &&
          "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        workflow.kind === "missing" && "border border-dashed bg-transparent",
        className,
      )}
    >
      <DealWorkflowBadge workflow={workflow} />
      {nextTask ? (
        <span className="min-w-0 flex-1 truncate" title={nextTask.text}>
          {nextTask.text}
          {dueLabel ? ` · ${dueLabel}` : ""}
        </span>
      ) : null}
      {remaining > 0 ? (
        <span className="shrink-0 tabular-nums">
          {translate("resources.deals.workflow.more", {
            count: remaining,
            _: `+${remaining}`,
          })}
        </span>
      ) : null}
    </div>
  );
};
