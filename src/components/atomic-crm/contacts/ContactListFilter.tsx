import { endOfYesterday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CheckSquare, Clock, Tag, TrendingUp } from "lucide-react";
import {
  useGetIdentity,
  useGetList,
  useListContext,
  useTranslate,
} from "ra-core";
import matches from "lodash/matches";
import pickBy from "lodash/pickBy";
import type { ReactElement } from "react";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { FilterCategory } from "../filters/FilterCategory";
import { OwnerFilterCategory } from "../filters/OwnerFilterCategory";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveFilterButton } from "../misc/ActiveFilterButton";

const isFilterValueActive = (
  value: Record<string, unknown>,
  filterValues: Record<string, unknown>,
) => matches(pickBy(value, (val) => typeof val !== "undefined"))(filterValues);

const ContactFilterToggleButton = ({
  label,
  value,
  size,
}: {
  label: ReactElement | string;
  value: Record<string, unknown>;
  size?: "default" | "sm" | "lg" | "icon" | null;
}) => {
  const { filterValues } = useListContext();
  const isActive = isFilterValueActive(value, filterValues || {});
  return (
    <ToggleFilterButton
      className={cn(
        "w-auto md:w-full justify-between h-10 md:h-8",
        isActive && "bg-primary/10 text-primary",
      )}
      label={label}
      value={value}
      size={size}
    />
  );
};

export const ContactListFilter = () => {
  const { noteStatuses } = useConfigurationContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { data } = useGetList("tags", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <ResponsiveFilters
      searchInput={{
        placeholder: translate("resources.contacts.filters.search"),
      }}
    >
      <FilterCategory
        label="resources.contacts.fields.last_seen"
        icon={<Clock />}
      >
        <ContactFilterToggleButton
          label="resources.contacts.filters.today"
          value={{
            "last_seen@gte": endOfYesterday().toISOString(),
            "last_seen@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ContactFilterToggleButton
          label="resources.contacts.filters.this_week"
          value={{
            "last_seen@gte": startOfWeek(new Date()).toISOString(),
            "last_seen@lte": undefined,
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ContactFilterToggleButton
          label="resources.contacts.filters.before_this_week"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfWeek(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ContactFilterToggleButton
          label="resources.contacts.filters.before_this_month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": startOfMonth(new Date()).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
        <ContactFilterToggleButton
          label="resources.contacts.filters.before_last_month"
          value={{
            "last_seen@gte": undefined,
            "last_seen@lte": subMonths(
              startOfMonth(new Date()),
              1,
            ).toISOString(),
          }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory
        label="resources.notes.fields.status"
        icon={<TrendingUp />}
      >
        {noteStatuses.map((status) => (
          <ContactFilterToggleButton
            key={status.value}
            label={
              <span>
                {status.label} <Status status={status.value} />
              </span>
            }
            value={{ status: status.value }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory label="resources.contacts.filters.tags" icon={<Tag />}>
        {data &&
          data.map((record) => (
            <ContactFilterToggleButton
              key={record.id}
              label={
                <Badge
                  variant="secondary"
                  className="text-black text-sm md:text-xs font-normal cursor-pointer"
                  style={{
                    backgroundColor: record?.color,
                  }}
                >
                  {record?.name}
                </Badge>
              }
              value={{ "tags@cs": `{${record.id}}` }}
              size={isMobile ? "lg" : undefined}
            />
          ))}
      </FilterCategory>

      <FilterCategory
        icon={<CheckSquare />}
        label="resources.contacts.filters.tasks"
      >
        <ContactFilterToggleButton
          label="resources.tasks.filters.with_pending"
          value={{ "nb_tasks@gt": 0 }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <OwnerFilterCategory />
    </ResponsiveFilters>
  );
};

export const ContactListFilterSummary = () => {
  const { noteStatuses } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const { data } = useGetList("tags", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "name", order: "ASC" },
  });
  const { filterValues } = useListContext();
  const hasFilters = !!Object.entries(filterValues || {}).filter(
    ([key]) => key !== "q",
  ).length;

  if (!hasFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start mb-4 gap-1">
      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.today"
        value={{
          "last_seen@gte": endOfYesterday().toISOString(),
          "last_seen@lte": undefined,
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.this_week"
        value={{
          "last_seen@gte": startOfWeek(new Date()).toISOString(),
          "last_seen@lte": undefined,
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.before_this_week"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": startOfWeek(new Date()).toISOString(),
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.before_this_month"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": startOfMonth(new Date()).toISOString(),
        }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.before_last_month"
        value={{
          "last_seen@gte": undefined,
          "last_seen@lte": subMonths(startOfMonth(new Date()), 1).toISOString(),
        }}
      />

      {noteStatuses.map((status) => (
        <ActiveFilterButton
          key={status.value}
          className="w-auto justify-between h-8 bg-primary/10 text-primary"
          label={
            <span>
              {status.label} <Status status={status.value} />
            </span>
          }
          value={{ status: status.value }}
        />
      ))}

      {data &&
        data.map((record) => (
          <ActiveFilterButton
            className="w-auto justify-between h-8 bg-primary/10 text-primary"
            key={record.id}
            label={
              <Badge
                variant="secondary"
                className="text-black text-sm md:text-xs font-normal cursor-pointer"
                style={{
                  backgroundColor: record?.color,
                }}
              >
                {record?.name}
              </Badge>
            }
            value={{ "tags@cs": `{${record.id}}` }}
          />
        ))}

      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.tasks.filters.with_pending"
        value={{ "nb_tasks@gt": 0 }}
      />

      <ActiveFilterButton
        className="w-auto justify-between h-8 bg-primary/10 text-primary"
        label="resources.contacts.filters.managed_by_me"
        value={{ sales_id: identity?.id }}
      />
    </div>
  );
};
