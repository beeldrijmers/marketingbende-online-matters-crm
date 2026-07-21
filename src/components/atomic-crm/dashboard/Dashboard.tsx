import { useGetList } from "ra-core";

import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Contact, ContactNote, Deal } from "../types";
import { DashboardStepper } from "./DashboardStepper";
import { DashboardWorkspace } from "./DashboardWorkspace";

export const Dashboard = () => {
  const {
    data: contacts,
    total: totalContact,
    isPending: isPendingContact,
  } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
  });

  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contact_notes", {
      pagination: { page: 1, perPage: 1 },
    });

  const { total: totalDeal, isPending: isPendingDeal } = useGetList<Deal>(
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
      <div className="mt-1 grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="flex flex-col gap-5 xl:col-span-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
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
    // Pass the real progress and the first contact id so the stepper's
    // checklist stays truthful and the "add note" action only links to a
    // contact that actually exists (never `/contacts/undefined/show`).
    return (
      <DashboardStepper
        step={!totalContact ? 1 : !totalContactNotes ? 2 : 3}
        contactId={contacts?.[0]?.id}
      />
    );
  }

  return (
    <div className="mt-1 min-w-0">
      <DashboardWorkspace hasDeals={Boolean(totalDeal)} />
    </div>
  );
};
