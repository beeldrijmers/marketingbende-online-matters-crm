import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityCompanyCreated } from "../types";
import { ActivityActorAvatar, useActor } from "./ActivityActor";
import { useActivityLogContext } from "./ActivityLogContext";

type ActivityLogCompanyCreatedProps = {
  activity: ActivityCompanyCreated;
};

export function ActivityLogCompanyCreated({
  activity,
}: ActivityLogCompanyCreatedProps) {
  const context = useActivityLogContext();
  const translate = useTranslate();
  const { company } = activity;
  const { isCurrentUser, name } = useActor(activity.sales_id);
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <ActivityActorAvatar salesId={activity.sales_id} />
        <CompanyAvatar width={20} height={20} record={company} />

        <span className="text-muted-foreground text-sm flex-grow">
          {translate(
            isCurrentUser
              ? "crm.activity.you_added_company"
              : "crm.activity.added_company",
            { name },
          )}{" "}
          <Link to={`/companies/${company.id}/show`}>{company.name}</Link>
          {context === "all" && (
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
    </div>
  );
}
