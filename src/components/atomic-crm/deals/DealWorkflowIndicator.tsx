import { CalendarClock, CircleAlert, Clock3, ListTodo } from "lucide-react";
import { useTranslate } from "ra-core";

import { cn } from "@/lib/utils";
import type { Deal, Task } from "../types";
import { formatISODateString } from "./dealUtils";
import { getDealWorkflow, type DealWorkflow } from "./dealWorkflow";

/**
 * How a deal's next step is doing.
 *
 * Colour is rationed here on purpose: a red banner on nine cards out of ten
 * (which is what the old full-width bar produced) trains people to ignore red.
 * Only a genuinely late step gets a tinted chip; everything else is quiet text.
 */
type WorkflowTone = "late" | "wait" | "quiet";

const toneOf = (workflow: DealWorkflow): WorkflowTone => {
  // Only a task that is actually past due is "late". A passed expected closing
  // date ("planning verlopen") is the normal state of roughly half the board,
  // so it stays quiet — otherwise red would mean "a deal exists".
  if (workflow.kind === "overdue") return "late";
  if (workflow.kind === "today") return "wait";
  return "quiet";
};

const chipTone: Record<WorkflowTone, string> = {
  late: "bg-late-tint text-late",
  wait: "text-wait",
  quiet: "text-ink-3",
};

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

/** Compact state chip, used on cards and in the attention queue. */
export const DealWorkflowBadge = ({ workflow }: { workflow: DealWorkflow }) => {
  const label = useWorkflowLabel(workflow);
  const tone = toneOf(workflow);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-eyebrow tracking-normal",
        chipTone[tone],
      )}
    >
      <WorkflowIcon workflow={workflow} />
      {/* On a 390px row the state label competes with the client name, so it
          collapses to its icon and keeps the name for screen readers. */}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  );
};

/**
 * The next-step line under a card: state chip plus the task itself.
 *
 * `dense` (the board) shows one truncated line; the attention view uses the
 * roomier variant with the plan-a-task affordance.
 */
export const DealWorkflowIndicator = ({
  deal,
  openTasks = [],
  className,
  dense = false,
  onPlanTask,
}: {
  deal: Deal;
  openTasks?: Task[];
  className?: string;
  dense?: boolean;
  onPlanTask?: () => void;
}) => {
  const translate = useTranslate();
  const workflow = getDealWorkflow(deal, openTasks);
  if (
    workflow.kind === "complete" ||
    workflow.kind === "on_hold" ||
    workflow.kind === "missing"
  ) {
    return null;
  }

  const nextTask = workflow.nextTask;
  const dueLabel = nextTask?.due_date
    ? formatISODateString(nextTask.due_date.slice(0, 10))
    : null;
  const remaining = Math.max(0, workflow.openTaskCount - 1);
  const tone = toneOf(workflow);
  const canPlanTask =
    onPlanTask != null &&
    nextTask == null &&
    workflow.kind === "overdue_closing";

  // On the dense board a scheduled, on-time step is not news: the card stays
  // silent so the eye only stops at the ones that need a person.
  if (dense && tone === "quiet" && workflow.kind === "scheduled") return null;

  const content = (
    <>
      <DealWorkflowBadge workflow={workflow} />
      {nextTask ? (
        <span
          className={cn("min-w-0 flex-1 truncate text-ink-3")}
          title={nextTask.text}
        >
          {nextTask.text}
          {dueLabel && !dense ? ` · ${dueLabel}` : ""}
        </span>
      ) : null}
      {remaining > 0 && !dense ? (
        <span className="num shrink-0 text-ink-3">
          {translate("resources.deals.workflow.more", {
            count: remaining,
            _: `+${remaining}`,
          })}
        </span>
      ) : null}
    </>
  );

  const containerClassName = cn(
    "flex min-w-0 items-center gap-1.5 text-meta",
    !dense && "rounded-md bg-sunken px-2 py-1",
    !dense && tone === "late" && "bg-late-tint",
    canPlanTask &&
      "w-full cursor-pointer text-left transition-colors duration-1 hover:bg-accent-quiet focus-visible:outline-none",
    className,
  );

  if (canPlanTask) {
    return (
      <button
        type="button"
        className={containerClassName}
        aria-label={translate("resources.deals.workflow.plan_task_for", {
          name: deal.name,
          _: `Volgende taak plannen voor ${deal.name}`,
        })}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onPlanTask();
        }}
      >
        {content}
      </button>
    );
  }

  return <div className={containerClassName}>{content}</div>;
};
