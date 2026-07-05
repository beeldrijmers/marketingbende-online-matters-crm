import { Fragment } from "react";
import { isToday, isYesterday } from "date-fns";
import {
  useListContext,
  useInfinitePaginationContext,
  useLocaleState,
  useTranslate,
  type TranslateFunction,
} from "ra-core";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/admin/spinner";
import { RotateCcw } from "lucide-react";
import {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "../consts";
import type { Activity } from "../types";
import { formatLocalizedDate } from "../misc/RelativeDate";
import { ActivityLogCompanyCreated } from "./ActivityLogCompanyCreated";
import { ActivityLogContactCreated } from "./ActivityLogContactCreated";
import { ActivityLogContactNoteCreated } from "./ActivityLogContactNoteCreated";
import { ActivityLogDealCreated } from "./ActivityLogDealCreated";
import { ActivityLogDealNoteCreated } from "./ActivityLogDealNoteCreated";
import { InfinitePagination } from "../misc/InfinitePagination";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityDayGroup = {
  key: string;
  label: string;
  items: Activity[];
};

const dayKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const dayLabelOf = (
  date: Date,
  isoDate: string,
  translate: TranslateFunction,
  locale: string,
): string => {
  if (isToday(date)) {
    return translate("crm.activity.today", { _: "Vandaag" });
  }
  if (isYesterday(date)) {
    return translate("crm.activity.yesterday", { _: "Gisteren" });
  }
  return formatLocalizedDate(isoDate, locale);
};

/**
 * Groups the (date-descending) activity feed into per-day buckets. Purely
 * derived in render: the input array and records are never mutated. Because the
 * list is sorted by date DESC, same-day items are contiguous, so it is enough
 * to compare each item with the current (last) group.
 */
const groupActivitiesByDay = (
  activities: Activity[],
  translate: TranslateFunction,
  locale: string,
): ActivityDayGroup[] =>
  activities.reduce<ActivityDayGroup[]>((groups, activity) => {
    const date = new Date(activity.date);
    const key = dayKeyOf(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      return [
        ...groups.slice(0, -1),
        { ...last, items: [...last.items, activity] },
      ];
    }
    return [
      ...groups,
      {
        key,
        label: dayLabelOf(date, activity.date, translate, locale),
        items: [activity],
      },
    ];
  }, []);

export function ActivityLogIterator() {
  const isMobile = useIsMobile();
  const { data, isPending, error, refetch } = useListContext<Activity>();
  const { hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfinitePaginationContext();
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();

  if (isPending) {
    return (
      <div className="mt-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="space-y-2 mt-1" key={index}>
            <div className="flex flex-row space-x-2 items-center">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="w-full h-4" />
            </div>
            <Skeleton className="w-full h-12" />
            <Separator />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data?.length) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          {translate("crm.dashboard.latest_activity_error", {
            _: "Error loading latest activity",
          })}
        </div>
        <div className="text-center mt-2">
          <Button onClick={() => refetch()}>
            <RotateCcw />
            {translate("crm.common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const groups = groupActivitiesByDay(data ?? [], translate, locale);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          {group.items.map((activity, index) => (
            <Fragment key={activity.id ?? index}>
              <ActivityItem activity={activity} />
              {index < group.items.length - 1 && <Separator />}
            </Fragment>
          ))}
        </section>
      ))}

      {/* Desktop: explicit Load More button */}
      {!isMobile && hasNextPage && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            fetchNextPage();
          }}
          className="flex w-full justify-center text-sm underline hover:no-underline"
        >
          {isFetchingNextPage ? (
            <Spinner />
          ) : (
            translate("crm.activity.load_more")
          )}
        </a>
      )}

      {/* Mobile: auto-load on scroll via IntersectionObserver */}
      {isMobile && (
        <div className="flex justify-center">
          <InfinitePagination />
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  if (activity.type === COMPANY_CREATED) {
    return <ActivityLogCompanyCreated activity={activity} />;
  }

  if (activity.type === CONTACT_CREATED) {
    return <ActivityLogContactCreated activity={activity} />;
  }

  if (activity.type === CONTACT_NOTE_CREATED) {
    return <ActivityLogContactNoteCreated activity={activity} />;
  }

  if (activity.type === DEAL_CREATED) {
    return <ActivityLogDealCreated activity={activity} />;
  }

  if (activity.type === DEAL_NOTE_CREATED) {
    return <ActivityLogDealNoteCreated activity={activity} />;
  }

  return null;
}
