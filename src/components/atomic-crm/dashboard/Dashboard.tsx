import { useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";

import {
  BOARD_PATH,
  DEAL_ATTENTION_PATH,
  FINANCE_PATH,
  INTEGRATIONS_PATH,
  UPDATES_PATH,
} from "../root/routes";
import { PageBody } from "../layout/PageBody";
import { PageHeader } from "../layout/PageHeader";
import type { Company, Contact, ContactNote, Deal, Task } from "../types";
import { selectAttentionDeals } from "../deals/dashboardDealKanbanModel";
import { summarizeDealAttention } from "../deals/dealWorkflow";
import { DashboardStepper } from "./DashboardStepper";
import { DealActionQueue } from "./DealActionQueue";
import { HotContacts } from "./HotContacts";
import { TasksList } from "./TasksList";
import { Welcome } from "./Welcome";

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// The dashboard used to be a five-tab workspace; those tabs are pages now.
// Old bookmarks and links keep working.
const LEGACY_TAB_TARGETS: Record<string, string> = {
  workboard: BOARD_PATH,
  finance: FINANCE_PATH,
  updates: UPDATES_PATH,
  integrations: INTEGRATIONS_PATH,
};

export const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const focus = searchParams.get("focus");

  if (tab && tab !== "today") {
    const target = LEGACY_TAB_TARGETS[tab];
    if (target) {
      // The billing tab became the finance page, which is where the invoicing
      // queue lives now.
      const boardTarget =
        target === BOARD_PATH && focus === "attention"
          ? DEAL_ATTENTION_PATH
          : target === BOARD_PATH && focus === "billing"
            ? FINANCE_PATH
            : target;
      return <Navigate to={boardTarget} replace />;
    }
  }

  return <Today />;
};

/** "Waar staan we vandaag": deviations first, then my work, then openings. */
const Today = () => {
  const translate = useTranslate();
  const isDemo = import.meta.env.VITE_IS_DEMO === "true";

  const { data: contacts, total: totalContact } = useGetList<Contact>(
    "contacts",
    { pagination: { page: 1, perPage: 1 } },
  );
  const { total: totalContactNotes } = useGetList<ContactNote>(
    "contact_notes",
    { pagination: { page: 1, perPage: 1 } },
  );
  const { total: totalCompany } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 1 },
  });
  const {
    data: deals = [],
    isPending: dealsPending,
    total: totalDeal,
  } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });
  const { data: tasks = [], isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );

  const counts = useMemo(
    () => summarizeDealAttention(selectAttentionDeals(deals, tasks)),
    [deals, tasks],
  );
  const isPending = dealsPending || tasksPending;

  if (isPending) return <TodaySkeleton />;

  // Only greet a brand-new, completely empty CRM with the setup guide.
  if (!totalContact && !totalContactNotes && !totalDeal && !totalCompany) {
    return (
      <DashboardStepper
        step={!totalContact ? 1 : !totalContactNotes ? 2 : 3}
        contactId={contacts?.[0]?.id}
      />
    );
  }

  const meta = [
    DATE_FORMATTER.format(new Date()),
    counts.overdue
      ? translate("crm.dashboard.deal_actions.counts.overdue", {
          count: counts.overdue,
          _: `${counts.overdue} te laat`,
        })
      : null,
    counts.today
      ? translate("crm.dashboard.deal_actions.counts.today", {
          count: counts.today,
          _: `${counts.today} vandaag`,
        })
      : null,
    counts.unplanned
      ? translate("crm.dashboard.deal_actions.counts.unplanned", {
          count: counts.unplanned,
          _: `${counts.unplanned} zonder planning`,
        })
      : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={translate("crm.navigation.today", { _: "Vandaag" })}
        meta={meta.join(" · ")}
      />
      {isDemo ? (
        <PageBody className="mb-5">
          <Welcome />
        </PageBody>
      ) : null}
      <PageBody className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <DealActionQueue />
        </div>
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          <TasksList />
          <HotContacts />
        </div>
      </PageBody>
    </>
  );
};

const TodaySkeleton = () => (
  <>
    <PageHeader title={<Skeleton className="h-6 w-40" />} />
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
      <div className="flex flex-col gap-4 xl:col-span-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="flex flex-col gap-4 xl:col-span-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  </>
);
