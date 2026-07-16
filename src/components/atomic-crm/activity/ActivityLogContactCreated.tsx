import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Avatar } from "../contacts/Avatar";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityContactCreated } from "../types";
import { ActivityActorAvatar } from "./ActivityActor";
import { useActivityLogContext } from "./ActivityLogContext";
import { useActor } from "./useActivityActor";

type ActivityLogContactCreatedProps = {
  activity: ActivityContactCreated;
};

export function ActivityLogContactCreated({
  activity,
}: ActivityLogContactCreatedProps) {
  const context = useActivityLogContext();
  const translate = useTranslate();
  const { contact } = activity;
  const { isCurrentUser, name } = useActor(activity.sales_id, {
    source: contact.activity_source,
    sourceAuthor: contact.activity_source_author,
  });
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <ActivityActorAvatar
          salesId={activity.sales_id}
          source={contact.activity_source}
          sourceAuthor={contact.activity_source_author}
        />
        <Avatar width={20} height={20} record={contact} />
        <span className="text-muted-foreground text-sm flex-grow">
          {translate(
            isCurrentUser
              ? "crm.activity.you_added_contact"
              : "crm.activity.added_contact",
            { name },
          )}{" "}
          <Link to={`/contacts/${contact.id}/show`}>
            {contact.first_name} {contact.last_name}
          </Link>
          {context !== "company" && (
            <>
              {activity.company_id != null && (
                <>
                  {" "}
                  {translate("crm.activity.to")}{" "}
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    record={activity}
                    link="show"
                  />
                </>
              )}{" "}
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
    </div>
  );
}
