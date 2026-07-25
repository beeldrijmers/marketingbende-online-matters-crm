import { useTranslate } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";
import { SectionHeader } from "../layout/SectionHeader";

export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        title={translate("crm.dashboard.latest_activity", {
          _: "Recente updates",
        })}
        meta={translate("crm.dashboard.latest_activity_meta", {
          _: "Notities en wijzigingen uit het CRM en de gekoppelde bronnen",
        })}
      />
      {isMobile ? (
        <ActivityLog pageSize={8} />
      ) : (
        <div className="panel p-4">
          <ActivityLog pageSize={8} />
        </div>
      )}
    </div>
  );
}
