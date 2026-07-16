import { useRecordContext, useTranslate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar } from "../contacts/Avatar";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityContactNoteCreated, Contact } from "../types";
import { ActivityActorAvatar } from "./ActivityActor";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";
import { parseActivityNote } from "./activityNote";
import { useActor } from "./useActivityActor";

type ActivityLogContactNoteCreatedProps = {
  activity: ActivityContactNoteCreated;
};

function ContactAvatar() {
  const record = useRecordContext<Contact>();
  return <Avatar width={20} height={20} record={record} />;
}

export function ActivityLogContactNoteCreated({
  activity,
}: ActivityLogContactNoteCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { contactNote } = activity;
  const parsedNote = parseActivityNote(contactNote.text);
  const source = parsedNote.source ?? contactNote.activity_source;
  const sourceAuthor =
    parsedNote.sourceAuthor ?? contactNote.activity_source_author;
  const { isCurrentUser, name } = useActor(activity.sales_id, {
    source,
    sourceAuthor,
  });
  const link = isMobile
    ? `/contacts/${contactNote.contact_id}/notes/${contactNote.id}`
    : `/contacts/${contactNote.contact_id}/show`;
  return (
    <ActivityLogNote
      header={
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ActivityActorAvatar
            salesId={activity.sales_id}
            source={source}
            sourceAuthor={sourceAuthor}
          />
          <ReferenceField
            source="contact_id"
            reference="contacts"
            record={activity.contactNote}
          >
            <ContactAvatar />
          </ReferenceField>

          <span className="basis-full text-sm leading-5 text-muted-foreground sm:basis-auto sm:flex-grow">
            {translate(
              isCurrentUser
                ? "crm.activity.you_added_note"
                : "crm.activity.added_note",
              { name },
            )}{" "}
            <ReferenceField
              source="contact_id"
              reference="contacts"
              record={activity.contactNote}
            >
              <TextField source="first_name" /> <TextField source="last_name" />
            </ReferenceField>
            {context !== "company" && (
              <>
                {" "}
                <RelativeDate date={activity.date} />
              </>
            )}
          </span>

          {context === "company" && (
            <span className="text-muted-foreground text-sm">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={contactNote.text}
      link={link}
      sourceAuthorInHeader={source === "trello"}
    />
  );
}
