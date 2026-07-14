import { ArrowRight, Flame, Link2Off } from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { DealWorkflowBadge } from "../deals/DealWorkflowIndicator";
import { buildOpenTasksByDeal } from "../deals/dealWorkflow";
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
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-3">
        <Flame className="mt-0.5 size-6 shrink-0 text-orange-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            {translate("resources.contacts.hot.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {translate("resources.contacts.hot.subtitle")}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to="/deals">
            {translate("resources.contacts.hot.open_board")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <Card className="divide-y overflow-hidden py-0">
        {isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : hotLeads.length === 0 ? (
          <div className="flex items-start gap-3 p-5">
            <Flame className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {translate("resources.contacts.hot.empty_title")}
              </p>
              <p className="text-sm text-muted-foreground">
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
                <div className="flex min-w-0 items-start gap-3 p-4">
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <CompanyAvatar />
                  </ReferenceField>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <Link
                        to={`/deals/${lead.primaryDeal.id}/show`}
                        className="min-w-0 flex-1 no-underline hover:underline"
                      >
                        <span className="block truncate text-sm font-semibold text-foreground">
                          <ReferenceField
                            source="company_id"
                            reference="companies"
                            link={false}
                          />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {lead.primaryDeal.name}
                        </span>
                      </Link>
                      <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300">
                        <Flame />
                        {translate("resources.contacts.hot.hot_label")}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {lead.contact ? (
                        <Link
                          to={`/contacts/${lead.contact.id}/show`}
                          className="font-medium text-foreground no-underline hover:underline"
                        >
                          {contactName ||
                            translate("resources.contacts.hot.unnamed_contact")}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
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

                    <div className="mt-2">
                      <DealWorkflowBadge workflow={lead.workflow} />
                    </div>
                  </div>
                </div>
              </RecordContextProvider>
            );
          })
        )}
      </Card>

      {!isPending && hotLeads.length > PAGE_SIZE ? (
        <p className="text-right text-xs text-muted-foreground">
          {translate("resources.contacts.hot.more", {
            count: hotLeads.length - PAGE_SIZE,
          })}
        </p>
      ) : null}
    </section>
  );
};
