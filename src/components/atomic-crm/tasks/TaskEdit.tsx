import {
  EditBase,
  Form,
  useNotify,
  useRecordContext,
  useTranslate,
  type Identifier,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Task } from "../types";
import { TaskFormContent } from "./TaskFormContent";

export const TaskEdit = ({
  open,
  close,
  taskId,
}: {
  taskId: Identifier;
  open: boolean;
  close: () => void;
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  return (
    <Dialog open={open} onOpenChange={close}>
      {open && taskId && (
        <EditBase
          id={taskId}
          resource="tasks"
          className="mt-0"
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("resources.tasks.updated", {
                type: "info",
                undoable: true,
              });
            },
          }}
          redirect={false}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.tasks.action.edit")}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent />
              <DialogFooter className="w-full sm:justify-between gap-4">
                <TaskDeleteButton close={close} />
                <SaveButton label="ra.action.save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};

// Trello owns trello-sourced tasks: deleting them in the CRM would be silently
// undone by the next Trello sync, so the delete button is hidden for those.
// The placeholder keeps the save button right-aligned in the footer.
const TaskDeleteButton = ({ close }: { close: () => void }) => {
  const notify = useNotify();
  const record = useRecordContext<Task>();

  if (record?.source === "trello") {
    return <span aria-hidden="true" />;
  }

  return (
    <DeleteButton
      mutationOptions={{
        onSuccess: () => {
          close();
          notify("resources.tasks.deleted", {
            type: "info",
            undoable: true,
          });
        },
      }}
      redirect={false}
    />
  );
};
