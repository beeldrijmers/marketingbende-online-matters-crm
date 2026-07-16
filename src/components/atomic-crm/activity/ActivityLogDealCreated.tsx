import { type RaRecord, useTranslate } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityDealCreated } from "../types";
import { ActivityActorAvatar } from "./ActivityActor";
import { useActivityLogContext } from "./ActivityLogContext";
import { useActor } from "./useActivityActor";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealCreatedProps = {
  activity: RaRecord & ActivityDealCreated;
};

export function ActivityLogDealCreated({
  activity,
}: ActivityLogDealCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { deal } = activity;
  const source =
    deal.activity_source ?? (deal.trello_card_id ? "trello" : null);
  const { isCurrentUser, name } = useActor(activity.sales_id, {
    source,
    sourceAuthor: deal.activity_source_author,
  });
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <ActivityActorAvatar
          salesId={activity.sales_id}
          source={source}
          sourceAuthor={deal.activity_source_author}
        />
        <div className="w-[20px] h-[20px] bg-muted rounded-full shrink-0" />
        <span className="text-muted-foreground text-sm flex-grow">
          {translate(
            isCurrentUser
              ? "crm.activity.you_added_deal"
              : "crm.activity.added_deal",
            { name },
          )}{" "}
          {isMobile ? (
            deal.name
          ) : (
            <Link to={`/deals/${deal.id}/show`}>{deal.name}</Link>
          )}{" "}
          {context !== "company" && (
            <>
              {translate("crm.activity.to")}{" "}
              <ReferenceField
                source="company_id"
                reference="companies"
                record={activity}
                link="show"
              />{" "}
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
