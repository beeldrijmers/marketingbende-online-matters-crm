import { CircleX, Edit, Save, Trash2 } from "lucide-react";
import {
  Form,
  useDelete,
  useNotify,
  useResourceContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useRef, useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Markdown } from "../misc/Markdown";
import { RelativeDate } from "../misc/RelativeDate";
import type { ContactNote, DealNote } from "../types";
import { NoteAttachments } from "./NoteAttachments";
import { NoteAuthorLine } from "./NoteAuthorLine";
import { NoteInputs } from "./NoteInputs";
import { useIsMobile } from "@/hooks/use-mobile";

export const Note = ({
  showStatus,
  note,
}: {
  showStatus?: boolean;
  note: DealNote | ContactNote;
  isLast: boolean;
}) => {
  const isMobile = useIsMobile();
  const [isEditing, setEditing] = useState(false);
  const [isExpanded, setExpanded] = useState(false);
  const [isTruncated, setTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const resource = useResourceContext();
  const notify = useNotify();
  const translate = useTranslate();

  // Detect if content is truncated
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [note.text]);

  const [update, { isPending }] = useUpdate();

  const [deleteNote] = useDelete(resource, undefined, {
    mutationMode: "undoable",
    onSuccess: () => {
      notify("resources.notes.deleted", {
        type: "info",
        undoable: true,
        messageArgs: {
          _: "Note deleted",
        },
      });
    },
  });

  const handleDelete = () => {
    deleteNote(resource, { id: note.id, previousData: note });
  };

  const handleEnterEditMode = () => {
    setEditing(!isEditing);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleNoteUpdate: SubmitHandler<FieldValues> = (values) => {
    update(
      resource,
      { id: note.id, data: values, previousData: note },
      {
        onSuccess: () => {
          setEditing(false);
        },
      },
    );
  };

  const content = (
    <div className="mb-4 group">
      <div className="flex items-center space-x-4 w-full">
        <NoteAuthorLine note={note} showStatus={showStatus} />
        {/* Always shown on touch/mobile (no hover there); on desktop the buttons
            fade in on hover and on keyboard focus so they stay reachable. */}
        <span
          className={cn(
            "transition-opacity",
            !isMobile &&
              "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEnterEditMode}
                  aria-label={translate("resources.notes.action.edit")}
                  className="p-1 h-auto cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{translate("resources.notes.action.edit")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  aria-label={translate("resources.notes.action.delete")}
                  className="p-1 h-auto cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{translate("resources.notes.action.delete")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        <div className="flex-1"></div>
        <span className="text-sm text-muted-foreground">
          <RelativeDate date={note.date} />
        </span>
      </div>
      {isEditing ? (
        <Form onSubmit={handleNoteUpdate} record={note} className="mt-1">
          <NoteInputs showStatus={showStatus} />
          <div className="flex justify-end mt-2 space-x-4">
            <Button
              variant="ghost"
              onClick={handleCancelEdit}
              type="button"
              className="cursor-pointer"
            >
              <CircleX className="w-4 h-4" />
              {translate("ra.action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {translate("resources.notes.action.update")}
            </Button>
          </div>
        </Form>
      ) : (
        <div className="pt-2 text-sm max-w-150">
          {note.text && (
            <div
              ref={contentRef}
              className={cn(
                "overflow-hidden transition-[max-height] duration-300 ease-in-out",
                isExpanded ? "max-h-[5000px]" : "max-h-46",
              )}
            >
              <Markdown>{note.text}</Markdown>
            </div>
          )}
          {isTruncated && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!isExpanded);
              }}
              className="text-primary text-sm mt-1 underline hover:no-underline cursor-pointer"
            >
              {isExpanded
                ? translate("crm.common.show_less")
                : translate("crm.common.read_more")}
            </button>
          )}

          {note.attachments && <NoteAttachments note={note} />}
        </div>
      )}
    </div>
  );

  return content;
};
