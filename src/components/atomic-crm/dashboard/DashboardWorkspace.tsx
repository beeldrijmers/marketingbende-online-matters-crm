import {
  Activity,
  Cable,
  CircleDollarSign,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BillingQueue } from "./BillingQueue";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DealActionQueue } from "./DealActionQueue";
import { HotContacts } from "./HotContacts";
import { IntegrationStatus } from "./IntegrationStatus";
import { RevenueDisclosure } from "./RevenueDisclosure";
import { TasksList } from "./TasksList";
import { TrelloWorkflowOverview } from "./TrelloWorkflowOverview";
import { Welcome } from "./Welcome";

const dashboardViews = [
  { value: "workboard", label: "Werkbord", icon: LayoutDashboard },
  { value: "today", label: "Vandaag", icon: Sparkles },
  { value: "updates", label: "Updates", icon: Activity },
  { value: "finance", label: "Financieel", icon: CircleDollarSign },
  { value: "integrations", label: "Koppelingen", icon: Cable },
] as const;

export const DashboardWorkspace = ({
  hasDeals,
  mobile = false,
}: {
  hasDeals: boolean;
  mobile?: boolean;
}) => {
  const isDemo = import.meta.env.VITE_IS_DEMO === "true";
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("tab");
  const activeView = dashboardViews.some(({ value }) => value === requestedView)
    ? requestedView!
    : isDemo
      ? "today"
      : "workboard";

  const changeView = (nextView: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("tab", nextView);
        if (nextView !== "workboard") {
          next.delete("focus");
          next.delete("deal");
          next.delete("edit");
          next.delete("new");
          next.delete("filter");
          next.delete("q");
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <Tabs
      value={activeView}
      onValueChange={changeView}
      className="min-w-0 gap-4"
    >
      <div className="overflow-x-auto pb-0.5">
        <TabsList
          aria-label="Dashboardonderdeel kiezen"
          className="h-11 min-w-max gap-1 rounded-xl border bg-card p-1 shadow-sm"
        >
          {dashboardViews.map(({ icon: Icon, label, value }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-9 gap-2 rounded-lg px-3 sm:px-4"
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="workboard" className="min-w-0">
        {isDemo ? <Welcome /> : <TrelloWorkflowOverview mobile={mobile} />}
      </TabsContent>

      <TabsContent value="today">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
            {isDemo ? <Welcome /> : null}
            <DealActionQueue />
          </div>
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
            <HotContacts />
            <TasksList />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="updates">
        <div className={mobile ? undefined : "max-w-5xl"}>
          <DashboardActivityLog />
        </div>
      </TabsContent>

      <TabsContent value="finance">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            {hasDeals ? <RevenueDisclosure defaultOpen /> : null}
          </div>
          <div className="min-w-0 xl:col-span-4">
            <BillingQueue />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="integrations">
        <div className={mobile ? undefined : "max-w-4xl"}>
          {isDemo ? <Welcome /> : <IntegrationStatus />}
        </div>
      </TabsContent>
    </Tabs>
  );
};
