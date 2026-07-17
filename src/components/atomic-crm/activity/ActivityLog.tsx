import { InfiniteListBase } from "ra-core";
import type { Identifier } from "ra-core";

import { ActivityLogContext } from "./ActivityLogContext";
import { ActivityLogIterator } from "./ActivityLogIterator";

type ActivityLogProps = {
  companyId?: Identifier;
  pageSize?: number;
  context?: "company" | "contact" | "deal" | "all";
};

export function ActivityLog({
  companyId,
  pageSize = 20,
  context = "all",
}: ActivityLogProps) {
  return (
    <ActivityLogContext.Provider value={context}>
      <InfiniteListBase
        resource={context === "all" ? "activity_log_global" : "activity_log"}
        filter={companyId ? { company_id: companyId } : {}}
        sort={{ field: "date", order: "DESC" }}
        perPage={pageSize}
        disableSyncWithLocation
        // An activity feed should reflect what just happened. Without this, the
        // 60s query staleTime (and the mobile offline-first persisted cache) can
        // leave a just-created contact/note/company off the list until the cache
        // expires, so always refetch when the log mounts.
        queryOptions={{ refetchOnMount: "always" }}
      >
        <ActivityLogIterator />
      </InfiniteListBase>
    </ActivityLogContext.Provider>
  );
}
