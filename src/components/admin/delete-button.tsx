import * as React from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/admin/confirm";
import { humanize, singularize } from "inflection";
import type { UseDeleteOptions, RedirectionSideEffect } from "ra-core";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useResourceTranslation,
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";

export type DeleteButtonProps = {
  /**
   * Ask first. Deleting is undoable through the toast, but for records that
   * carry notes, tasks and attachments (a deal, a company) a mis-click is
   * expensive enough to warrant a question.
   */
  confirm?: boolean;
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: React.ReactEventHandler<HTMLButtonElement>;
  mutationOptions?: UseDeleteOptions;
  redirect?: RedirectionSideEffect;
  resource?: string;
  successMessage?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
};

/**
 * A button that deletes a record with undo capability.
 *
 * Renders a destructive button that deletes the current record and shows an undo notification.
 * Automatically redirects after deletion and works with the RecordContext.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/deletebutton/ DeleteButton documentation}
 *
 * @example
 * import { DeleteButton, Edit } from '@/components/admin';
 *
 * const PostEdit = () => (
 *     <Edit actions={<DeleteButton />}>
 *         ...
 *     </Edit>
 * );
 */
export const DeleteButton = (props: DeleteButtonProps) => {
  const {
    confirm = false,
    label: labelProp,
    onClick,
    size,
    mutationOptions,
    redirect = "list",
    successMessage,
    variant = "outline",
    className = "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);

  const { isPending, handleDelete } = useDeleteWithUndoController({
    record,
    resource,
    redirect,
    onClick,
    mutationOptions,
    successMessage,
  });
  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });
  // We don't support React elements for this
  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }
  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <>
      <Button
        variant={variant}
        type="button"
        onClick={
          confirm
            ? (event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }
            : handleDelete
        }
        disabled={isPending}
        aria-label={typeof label === "string" ? label : undefined}
        size={size}
        className={className}
      >
        <Trash />
        {label}
      </Button>
      {confirm ? (
        <Confirm
          isOpen={confirmOpen}
          loading={isPending}
          title="ra.message.delete_title"
          content="ra.message.delete_content"
          titleTranslateOptions={{
            name: resourceName,
            id: record?.id,
            recordRepresentation,
          }}
          contentTranslateOptions={{
            name: resourceName,
            id: record?.id,
            recordRepresentation,
          }}
          onConfirm={(event) => {
            setConfirmOpen(false);
            handleDelete(event);
          }}
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </>
  );
};
