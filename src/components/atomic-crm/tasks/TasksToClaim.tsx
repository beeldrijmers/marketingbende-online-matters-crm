import { useMemo } from "react";
import { HandHelping } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate, useUpdate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";

import type { Deal, Task } from "../types";

// Unassigned Trello-synced steps that anyone can pick up ("oppakken"). A single
// click claims the step by setting its owner to the current user, after which it
// moves into that person's "Mijn taken" list.
export const TasksToClaim = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const [update] = useUpdate();

  const { data: tasks } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "due_date", order: "ASC" },
    filter: { source: "trello" },
  });

  const claimable = useMemo(
    () =>
      (tasks ?? []).filter((task) => task.sales_id == null && !task.done_date),
    [tasks],
  );

  if (claimable.length === 0) {
    return null;
  }

  const handleClaim = (task: Task) => {
    if (!identity?.id) return;
    update("tasks", {
      id: task.id,
      data: { sales_id: identity.id },
      previousData: task,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <HandHelping className="w-4 h-4" />
        {translate("resources.tasks.to_claim", { _: "Op te pakken" })}
        <span className="text-xs font-normal">({claimable.length})</span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {claimable.map((task) => (
          <li
            key={task.id}
            className="flex items-start justify-between gap-2 py-2"
          >
            <div className="flex-grow text-sm">
              <div>{task.text}</div>
              <div className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                <span>
                  {translate("resources.tasks.fields.due_short")}
                  &nbsp;
                  <DateField source="due_date" record={task} showDate />
                </span>
                {task.deal_id != null && (
                  <ReferenceField<Task, Deal>
                    source="deal_id"
                    reference="deals"
                    record={task}
                    link="show"
                    className="inline text-sm text-muted-foreground"
                    render={({ referenceRecord }) =>
                      referenceRecord ? <> — {referenceRecord.name}</> : null
                    }
                  />
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => handleClaim(task)}
            >
              {translate("resources.tasks.actions.claim", { _: "Oppakken" })}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
