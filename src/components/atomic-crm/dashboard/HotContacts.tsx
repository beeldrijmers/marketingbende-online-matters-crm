import { Flame, Link2Off } from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { DealWorkflowBadge } from "../deals/DealWorkflowIndicator";
import {
  BOARD_PATH,
  getDashboardDealDetailPath,
} from "../deals/dashboardDealSelection";
import { buildOpenTasksByDeal } from "../deals/dealWorkflow";
import { SectionHeader } from "../layout/SectionHeader";
import type { Contact, Deal, Task } from "../types";
import { rankHotLeads } from "./hotLeads";

const PAGE_SIZE = 3;
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  maximumFractionDigits: 0,
  style: "currency",
});

export const HotContacts = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
  );
  const { data: tasks = [], isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );
  const { data: contacts = [], isPending: contactsPending } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "last_seen", order: "DESC" },
      filter: {},
    });

  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);
  const hotLeads = useMemo(
    () => rankHotLeads(deals, tasksByDeal, contacts),
    [contacts, deals, tasksByDeal],
  );
  const isPending = dealsPending || tasksPending || contactsPending;

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        title={translate("resources.contacts.hot.title")}
        meta={translate("resources.contacts.hot.subtitle")}
        to={BOARD_PATH}
        toLabel={translate("resources.contacts.hot.open_board")}
      />

      <div className="panel divide-y divide-line-subtle overflow-hidden">
        {isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : hotLeads.length === 0 ? (
          <div className="flex items-start gap-3 p-5">
            <Flame className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <div>
              <p className="text-body font-medium text-ink">
                {translate("resources.contacts.hot.empty_title")}
              </p>
              <p className="text-meta text-ink-3">
                {translate("resources.contacts.hot.empty_hint")}
              </p>
            </div>
          </div>
        ) : (
          hotLeads.slice(0, PAGE_SIZE).map((lead) => {
            const contactName = lead.contact
              ? `${lead.contact.first_name} ${lead.contact.last_name}`.trim()
              : null;

            return (
              <RecordContextProvider
                key={lead.primaryDeal.id}
                value={lead.primaryDeal}
              >
                <div className="flex min-w-0 items-start gap-2.5 p-3">
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <CompanyAvatar width={20} height={20} />
                  </ReferenceField>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <Link
                        to={getDashboardDealDetailPath(
                          BOARD_PATH,
                          lead.primaryDeal.id,
                        )}
                        className="min-w-0 flex-1 no-underline hover:underline"
                      >
                        <span className="block truncate text-body font-semibold text-ink">
                          <ReferenceField
                            source="company_id"
                            reference="companies"
                            link={false}
                          />
                        </span>
                        <span className="block truncate text-meta text-ink-3">
                          {lead.primaryDeal.name}
                        </span>
                      </Link>
                      <span
                        className={cn(
                          "num inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-eyebrow tracking-normal",
                          lead.tier === "hot" && "bg-late-tint text-late",
                          lead.tier === "warm" && "bg-wait-tint text-wait",
                          lead.tier === "watch" && "bg-sunken text-ink-3",
                        )}
                      >
                        {lead.tier === "hot" ? (
                          <Flame className="size-3" />
                        ) : null}
                        {translate(`resources.contacts.hot.tiers.${lead.tier}`)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
                      {lead.contact ? (
                        <Link
                          to={`/contacts/${lead.contact.id}/show`}
                          className="font-medium text-ink-2 no-underline hover:text-ink hover:underline"
                        >
                          {contactName ||
                            translate("resources.contacts.hot.unnamed_contact")}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-wait">
                          <Link2Off className="size-3.5" />
                          {translate("resources.contacts.hot.missing_contact")}
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {translate("resources.contacts.hot.active_deals", {
                          smart_count: lead.activeDealCount,
                        })}
                      </span>
                      {lead.totalAmount > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {translate("resources.contacts.hot.pipeline", {
                              amount: currencyFormatter.format(
                                lead.totalAmount,
                              ),
                            })}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <DealWorkflowBadge workflow={lead.workflow} />
                    </div>

                    <p className="mt-1 truncate text-meta text-ink-3">
                      {lead.reasons
                        .slice(0, 2)
                        .map((reason) =>
                          translate(`resources.contacts.hot.reasons.${reason}`),
                        )
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </RecordContextProvider>
            );
          })
        )}
      </div>

      {!isPending && hotLeads.length > PAGE_SIZE ? (
        <Link
          to={BOARD_PATH}
          className="self-end text-meta text-ink-3 no-underline hover:text-ink"
        >
          {translate("resources.contacts.hot.more", {
            count: hotLeads.length - PAGE_SIZE,
          })}
        </Link>
      ) : null}
    </section>
  );
};
