import { type RaRecord, useTranslate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import {
  DASHBOARD_WORKBOARD_PATH,
  getDashboardDealDetailPath,
} from "../deals/dashboardDealSelection";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityDealNoteCreated } from "../types";
import { ActivityActorAvatar } from "./ActivityActor";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";
import { parseActivityNote } from "./activityNote";
import { useActor } from "./useActivityActor";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealNoteCreatedProps = {
  activity: RaRecord & ActivityDealNoteCreated;
};

export function ActivityLogDealNoteCreated({
  activity,
}: ActivityLogDealNoteCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { dealNote } = activity;
  const parsedNote = parseActivityNote(dealNote.text);
  const source = parsedNote.source ?? dealNote.activity_source;
  const sourceAuthor =
    parsedNote.sourceAuthor ?? dealNote.activity_source_author;
  const { isCurrentUser, name } = useActor(activity.sales_id, {
    source,
    sourceAuthor,
  });
  return (
    <ActivityLogNote
      header={
        <div className="flex min-w-0 grow flex-wrap items-center gap-x-2 gap-y-1">
          <ActivityActorAvatar
            salesId={activity.sales_id}
            source={source}
            sourceAuthor={sourceAuthor}
          />
          <ReferenceField
            source="deal_id"
            reference="deals"
            record={dealNote}
            link={false}
          >
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            >
              <CompanyAvatar width={20} height={20} />
            </ReferenceField>
          </ReferenceField>

          <span className="basis-full text-sm leading-5 text-muted-foreground sm:basis-auto sm:grow">
            {translate(
              isCurrentUser
                ? "crm.activity.you_added_note_about_deal"
                : "crm.activity.added_note_about_deal",
              { name },
            )}{" "}
            <ReferenceField
              source="deal_id"
              reference="deals"
              record={dealNote}
              link={isMobile ? false : "show"}
            />
            {context !== "company" && (
              <>
                {" "}
                {translate("crm.activity.at_company")}{" "}
                <ReferenceField
                  source="deal_id"
                  reference="deals"
                  record={dealNote}
                  link={false}
                >
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link="show"
                  />
                </ReferenceField>{" "}
                <RelativeDate date={activity.date} />
              </>
            )}
          </span>

          {context === "company" && (
            <span className="text-sm text-muted-foreground">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={dealNote.text}
      link={
        isMobile
          ? false
          : getDashboardDealDetailPath(
              DASHBOARD_WORKBOARD_PATH,
              dealNote.deal_id,
            )
      }
      sourceAuthorInHeader={source === "trello"}
    />
  );
}
