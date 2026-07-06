import { useGetList } from "ra-core";

import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Contact, ContactNote } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealsChart } from "./DealsChart";
import { HotContacts } from "./HotContacts";
import { RevenueDashboard } from "./RevenueDashboard";
import { TasksList } from "./TasksList";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1 },
    });

  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contact_notes", {
      pagination: { page: 1, perPage: 1 },
    });

  const { total: totalDeal, isPending: isPendingDeal } = useGetList<Contact>(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  const { total: totalCompany, isPending: isPendingCompany } =
    useGetList<Company>("companies", {
      pagination: { page: 1, perPage: 1 },
    });

  const isPending =
    isPendingContact ||
    isPendingContactNotes ||
    isPendingDeal ||
    isPendingCompany;

  if (isPending) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-1">
        <div className="xl:col-span-3">
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="xl:col-span-6 flex flex-col gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="xl:col-span-3">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Only show the getting-started guide for a brand-new, completely empty CRM.
  // As soon as there is any data (contacts, companies or deals) we go straight
  // to the real dashboard: adding a contact or note is never a hard requirement.
  const isEmptyCrm =
    !totalContact && !totalContactNotes && !totalDeal && !totalCompany;

  if (isEmptyCrm) {
    return <DashboardStepper step={1} />;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-1">
      {/* Full-width revenue overview across the top of the dashboard. */}
      {totalDeal ? (
        <div className="xl:col-span-12 min-w-0">
          <RevenueDashboard />
        </div>
      ) : null}
      <div className="xl:col-span-3 min-w-0">
        <div className="flex flex-col gap-6">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
        </div>
      </div>
      <div className="xl:col-span-6 min-w-0">
        <div className="flex flex-col gap-6">
          {totalDeal ? <DealsChart /> : null}
          <DashboardActivityLog />
        </div>
      </div>

      <div className="xl:col-span-3 min-w-0">
        <TasksList />
      </div>
    </div>
  );
};
