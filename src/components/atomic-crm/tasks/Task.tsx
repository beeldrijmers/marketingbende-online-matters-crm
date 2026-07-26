import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDataProvider,
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal, Task as TData } from "../types";
import type { CrmDataProvider } from "../providers/types";
import { OwnerChipField } from "../sales/SaleAvatar";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  // Trello owns trello-sourced tasks: deleting them in the CRM would be
  // silently undone by the next Trello sync, so we never offer delete for them.
  const isTrelloTask = task.source === "trello";
  const isTrelloStep = isTrelloTask && !!task.trello_checkitem_id;

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => async () => {
    const previousDone = task.done_date ?? null;
    const nextDone = !task.done_date;
    update("tasks", {
      id: task.id,
      data: {
        done_date: nextDone ? new Date().toISOString() : null,
      },
      previousData: task,
    });
    // Two-way sync: reflect the completion on the Trello checklist item. Trello
    // stays the source of truth, so if the write-back fails we roll the CRM row
    // back to its previous state - otherwise the next card sync would silently
    // revert the user's action (Trello would still say "not done").
    if (isTrelloStep) {
      try {
        await dataProvider.completeTrelloStep(task.id, nextDone);
      } catch (error) {
        update("tasks", {
          id: task.id,
          data: { done_date: previousDone },
          previousData: { ...task, done_date: nextDone ? "pending" : null },
        });
        notify(
          (error as Error)?.message ?? "Kon de stap niet naar Trello bijwerken",
          { type: "error" },
        );
      }
    }
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        {/* Completing a task writes back to Trello and cannot be undone from
            here, so only the checkbox completes it. Tapping the row used to
            tick it off silently - including taps meant for the contact link. */}
        <div className="flex items-start gap-2 flex-1">
          <label
            htmlFor={labelId}
            className="-m-2 flex cursor-pointer items-start p-2"
          >
            <Checkbox
              id={labelId}
              checked={!!task.done_date}
              onCheckedChange={handleCheck()}
              disabled={isUpdatePending}
              aria-label={task.text}
            />
          </label>
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            <div className="text-sm">
              {task.type && task.type !== "none" && (
                <>
                  <span className="font-semibold text-sm">
                    {(() => {
                      const matchedTaskType = taskTypes.find(
                        (taskType) => taskType.value === task.type,
                      );
                      return matchedTaskType
                        ? matchedTaskType.label
                        : task.type;
                    })()}
                  </span>
                  &nbsp;
                </>
              )}
              {task.text}
            </div>
            {/* Quieter than the step itself: at the same size twelve rows read
                as one grey block. */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-ink-3">
              {/* Moved out of the title: a badge between the text and its own
                  wrap point split long steps across two lines. */}
              {isTrelloStep && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-muted-foreground"
                >
                  {translate("resources.tasks.trello_step", { _: "Trello" })}
                </Badge>
              )}
              <span>
                {translate("resources.tasks.fields.due_short")}
                &nbsp;
                <DateField
                  source="due_date"
                  record={task}
                  showDate
                  options={{ day: "numeric", month: "short", year: "numeric" }}
                />
              </span>
              {task.sales_id != null && (
                <>
                  <span aria-hidden="true">·</span>
                  {/* No party dot here: in a list where every row has the same
                      owner it is twelve identical dots and no information. */}
                  <OwnerChipField
                    source="sales_id"
                    record={task}
                    size={16}
                    showParty={false}
                  />
                </>
              )}
              {showContact && task.contact_id != null && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        {translate("resources.tasks.regarding_contact", {
                          name: getContactRepresentation(referenceRecord),
                        })}
                      </>
                    );
                  }}
                />
              )}
              {showContact && task.deal_id != null && (
                <ReferenceField<TData, Deal>
                  source="deal_id"
                  reference="deals"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        {translate("resources.tasks.regarding_deal", {
                          name: referenceRecord.name,
                          _: `· ${referenceRecord.name}`,
                        })}
                      </>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label={translate("resources.tasks.actions.title")}
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("resources.tasks.actions.postpone_tomorrow")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("resources.tasks.actions.postpone_next_week")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            {!isTrelloTask && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleDelete}
              >
                {translate("ra.action.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};
