import { useGetList, useTimeout } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import type { Company, Contact, ContactNote, Deal } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { Welcome } from "./Welcome";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-6"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

const Loading = () => (
  <Wrapper>
    <Skeleton className="h-4 w-3/4 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
  </Wrapper>
);

export const MobileDashboard = () => {
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
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
  const oneSecondHasPassed = useTimeout(1000);

  const isPending =
    isPendingContact ||
    isPendingContactNotes ||
    isPendingDeal ||
    isPendingCompany;

  if (isPending) {
    return oneSecondHasPassed ? <Loading /> : null;
  }

  // Only show the getting-started guide for a brand-new, completely empty CRM.
  // As soon as there is any data (contacts, companies or deals) we go straight
  // to the real dashboard: adding a contact or note is never a hard requirement.
  // Mirrors the desktop Dashboard so mobile no longer forces onboarding.
  const isEmptyCrm =
    !totalContact && !totalContactNotes && !totalDeal && !totalCompany;

  if (isEmptyCrm) {
    return (
      <Wrapper>
        <DashboardStepper step={1} />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
        <DashboardActivityLog />
      </div>
    </Wrapper>
  );
};
