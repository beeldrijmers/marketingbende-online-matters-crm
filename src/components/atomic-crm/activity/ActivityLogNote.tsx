import { ArrowUpRight, Paperclip, Trello } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Markdown } from "../misc/Markdown";
import { parseActivityNote } from "./activityNote";

type ActivityLogNoteProps = {
  header: ReactNode;
  text: string;
  link: string | false;
};

export function ActivityLogNote({ header, text, link }: ActivityLogNoteProps) {
  const translate = useTranslate();
  const [isExpanded, setExpanded] = useState(false);
  const [isTruncated, setTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const note = parseActivityNote(text);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || isExpanded) return;
    setTruncated(content.scrollHeight > content.clientHeight + 1);
  }, [isExpanded, note.body]);

  if (!text) {
    return null;
  }

  return (
    <article className="min-w-0">
      <div className="flex min-w-0 items-start">{header}</div>
      <div className="mt-1.5 min-w-0 sm:ml-7">
        <div className="relative w-full rounded-lg border bg-muted/25 px-3 py-2">
          {note.source === "trello" ? (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="gap-1 border-sky-500/40 bg-sky-500/5 px-1.5 py-0 text-[11px] text-sky-700 dark:text-sky-300"
              >
                {note.isAttachment ? (
                  <Paperclip className="size-3" />
                ) : (
                  <Trello className="size-3" />
                )}
                {note.isAttachment
                  ? translate("crm.activity.trello_attachment", {
                      _: "Trello-bijlage",
                    })
                  : "Trello"}
              </Badge>
              {note.sourceAuthor ? (
                <span className="text-xs font-medium text-foreground/80">
                  {note.sourceAuthor}
                </span>
              ) : null}
            </div>
          ) : null}

          <div
            ref={contentRef}
            className={cn(
              "overflow-hidden transition-[max-height] duration-200",
              isExpanded ? "max-h-[2000px]" : "max-h-[4.75rem]",
            )}
          >
            <Markdown className="break-words text-sm [&_p]:my-0 [&_p]:leading-5 [&_h1]:my-1 [&_h1]:text-base [&_h2]:my-1 [&_h2]:text-base [&_h3]:my-1 [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_pre]:my-2 [&_pre]:p-2">
              {note.body}
            </Markdown>
          </div>

          {!isExpanded && isTruncated ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-9 h-8 rounded-b-lg bg-gradient-to-t from-muted/95 to-transparent" />
          ) : null}

          <div className="mt-1.5 flex min-h-5 items-center justify-between gap-3">
            {isTruncated ? (
              <button
                type="button"
                onClick={() => setExpanded((expanded) => !expanded)}
                aria-expanded={isExpanded}
                className="text-xs font-medium text-primary hover:underline"
              >
                {isExpanded
                  ? translate("crm.common.show_less")
                  : translate("crm.common.read_more")}
              </button>
            ) : (
              <span />
            )}
            {link !== false ? (
              <Link
                to={link}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {translate("crm.activity.open_item", { _: "Open" })}
                <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
