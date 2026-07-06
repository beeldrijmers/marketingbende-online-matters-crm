import { useMemo } from "react";
import { useGetList, useRecordContext, useTranslate } from "ra-core";

import type { Deal, Task as TaskRecord } from "../types";
import { Task } from "../tasks/Task";

// Default next-step hints per deal stage, used when a deal has no Trello
// checklist of its own. This is what turns a passive mirror of Trello into a
// "what do we still need to do here?" helping hand.
const NEXT_ACTION_FALLBACK: Record<string, string> = {
  "informatie-pipeline": "Informatie verzamelen en een offerte opstellen.",
  bezig: "Het werk uitvoeren.",
  "on-hold": "In de wacht - opvolgen wanneer het weer kan.",
  "facturatie-live": "Factureren en het project live zetten.",
  won: "Afgerond.",
};

// Shows a deal's steps ("wat moet er nog gebeuren"): the open Trello checklist
// items first, a done count, and - when there is no checklist - a stage-based
// next-action hint.
export const DealSteps = () => {
  const record = useRecordContext<Deal>();
  const translate = useTranslate();

  const { data: steps, isPending } = useGetList<TaskRecord>(
    "tasks",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "due_date", order: "ASC" },
      filter: { deal_id: record?.id },
    },
    { enabled: record?.id != null },
  );

  const { open, doneCount, total } = useMemo(() => {
    const all = steps ?? [];
    const openSteps = all.filter((step) => !step.done_date);
    return {
      open: openSteps,
      doneCount: all.length - openSteps.length,
      total: all.length,
    };
  }, [steps]);

  if (isPending || !record) {
    return null;
  }

  const title = translate("resources.deals.steps.title", { _: "Stappen" });

  if (total === 0) {
    const hint = translate(`resources.deals.next_action.${record.stage}`, {
      _: NEXT_ACTION_FALLBACK[record.stage] ?? "",
    });
    if (!hint) return null;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground tracking-wide">
          {translate("resources.deals.steps.next_action", {
            _: "Volgende stap",
          })}
        </span>
        <p className="text-sm leading-6">{hint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-muted-foreground tracking-wide">
        {title}
        {" - "}
        {translate("resources.deals.steps.progress", {
          done: doneCount,
          total,
          _: `${doneCount}/${total} af`,
        })}
      </span>
      {open.length > 0 ? (
        <div className="flex flex-col gap-3">
          {open.map((step) => (
            <Task key={step.id} task={step} showContact={false} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate("resources.deals.steps.all_done", {
            _: "Alle stappen zijn afgerond.",
          })}
        </p>
      )}
    </div>
  );
};
