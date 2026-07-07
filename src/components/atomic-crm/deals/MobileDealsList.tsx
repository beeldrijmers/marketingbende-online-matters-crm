import { useMemo } from "react";
import {
  InfiniteListBase,
  RecordContextProvider,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AssigneesField } from "../sales/AssigneesField";
import type { Deal, DealStage } from "../types";
import { DealShow } from "./DealShow";

/**
 * Mobile deals view: the kanban board is desktop-only, so on mobile the deals
 * are shown as a tappable list grouped by stage (the columns of the desktop
 * board become sections). Each row shows company, name, amount and owner +
 * party. Registered as the `deals` list in the mobile Admin.
 */
export const MobileDealsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <InfiniteListBase
      perPage={1000}
      filter={{ "archived_at@is": null }}
      sort={{ field: "index", order: "ASC" }}
    >
      <DealsLayoutMobile />
    </InfiniteListBase>
  );
};

type DealGroup = { key: string; label: string; deals: Deal[] };

const groupDealsByStage = (
  deals: Deal[],
  dealStages: DealStage[],
  fallbackLabel: string,
): DealGroup[] => {
  const byStage = new Map<string, Deal[]>();
  for (const deal of deals) {
    const key = deal.stage ?? "";
    const bucket = byStage.get(key);
    if (bucket) bucket.push(deal);
    else byStage.set(key, [deal]);
  }

  const groups: DealGroup[] = [];
  // Configured stages first, in the pipeline order.
  for (const stage of dealStages) {
    const stageDeals = byStage.get(stage.value);
    if (stageDeals?.length) {
      groups.push({ key: stage.value, label: stage.label, deals: stageDeals });
      byStage.delete(stage.value);
    }
  }
  // Any deals with an unknown/empty stage go into a trailing group so nothing
  // is hidden.
  for (const [key, stageDeals] of byStage) {
    groups.push({
      key: key || "unknown",
      label: key || fallbackLabel,
      deals: stageDeals,
    });
  }
  return groups;
};

const DealsLayoutMobile = () => {
  const translate = useTranslate();
  const location = useLocation();
  const { dealStages } = useConfigurationContext();
  const { data, error, isPending } = useListContext<Deal>();

  // The deal detail is a URL-driven dialog (same pattern as the desktop board):
  // tapping a row navigates to /deals/:id/show, which this list matches and
  // opens over itself; closing redirects back to the list.
  const matchShow = matchPath("/deals/:id/show", location.pathname);

  const fallbackLabel = translate("resources.deals.other_stage", {
    _: "Overig",
  });
  const groups = useMemo(
    () => groupDealsByStage(data ?? [], dealStages, fallbackLabel),
    [data, dealStages, fallbackLabel],
  );

  return (
    <div>
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
      <MobileHeader>
        <h1 className="text-lg font-semibold">
          {translate("resources.deals.name", { smart_count: 2 })}
        </h1>
      </MobileHeader>
      <MobileContent>
        {isPending ? (
          <MobileDealsListSkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">
            {translate("ra.notification.http_error", {
              _: "Er ging iets mis bij het laden van de deals.",
            })}
          </p>
        ) : data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.deals.empty", { _: "Nog geen deals" })}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                  <span className="text-muted-foreground/70">
                    {group.deals.length}
                  </span>
                </h2>
                {group.deals.map((deal) => (
                  <RecordContextProvider key={deal.id} value={deal}>
                    <MobileDealRow deal={deal} />
                  </RecordContextProvider>
                ))}
              </div>
            ))}
          </div>
        )}
      </MobileContent>
    </div>
  );
};

const MobileDealsListSkeleton = () => (
  <div className="flex flex-col gap-6">
    {Array.from({ length: 3 }).map((_, groupIndex) => (
      <div key={groupIndex} className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <Skeleton key={rowIndex} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    ))}
  </div>
);

const MobileDealRow = ({ deal }: { deal: Deal }) => {
  const { currency } = useConfigurationContext();
  return (
    <Link to={`/deals/${deal.id}/show`} className="no-underline">
      <Card className="p-3 flex flex-col gap-1.5 transition-colors hover:bg-muted/60">
        <div className="flex items-center gap-2">
          <ReferenceField
            source="company_id"
            reference="companies"
            link={false}
          >
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>
          <span className="text-sm font-medium flex-1 truncate">
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            />
            {" - "}
            {deal.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            <NumberField
              source="amount"
              options={{
                notation: "compact",
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
                minimumSignificantDigits: 3,
              }}
              locales="nl-NL"
              // NumberField translates a string `empty` prop as an i18n key.
              empty="resources.deals.no_amount"
            />
          </span>
          <AssigneesField
            ids={deal.assignee_ids}
            size={16}
            className="text-xs text-muted-foreground"
          />
        </div>
      </Card>
    </Link>
  );
};
