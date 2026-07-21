import { MessagesSquare } from "lucide-react";
import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLog } from "../activity/ActivityLog";

export function DashboardActivityLog() {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start">
        <div className="mr-3 mt-0.5 flex">
          <MessagesSquare className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {translate("crm.dashboard.latest_activity", {
              _: "Recente updates",
            })}
          </h2>
          <p className="text-xs text-muted-foreground">
            Opmerkingen en wijzigingen uit gekoppelde bronnen en het CRM
          </p>
        </div>
      </div>
      {isMobile ? (
        <ActivityLog pageSize={8} />
      ) : (
        <Card className="p-4">
          <ActivityLog pageSize={8} />
        </Card>
      )}
    </div>
  );
}
