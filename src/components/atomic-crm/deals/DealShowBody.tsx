import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  InfiniteListBase,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";

import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { AssigneesField } from "../sales/AssigneesField";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { ContactList } from "./ContactList";
import { DealEditSheet } from "./DealEditSheet";
import { DealInboundEmail } from "./DealInboundEmail";
import { DealStatusUpdate } from "./DealStatusUpdate";
import { DealSteps } from "./DealSteps";
import { InzyteDealSection } from "./inzyte/InzyteDealSection";
import { MoneybirdDealSection } from "./MoneybirdDealSection";
import {
  findDealLabel,
  formatISODateString,
  formatTimestampDate,
  getDealDurationDays,
  isBeforeToday,
} from "./dealUtils";

/**
 * One opdracht, read as a page: what it is and what it is worth on the left,
 * the facts that never move on the right.
 *
 * The previous layout was a single scrolling column where the description
 * pushed the money, the dates and the next steps below the fold, and every
 * integration block carried its own tinted background.
 */
export const DealShowBody = ({
  closeTo,
  editTo,
}: {
  closeTo: string;
  editTo?: string;
}) => {
  const translate = useTranslate();
  const { dealStages, dealCategories, currency } = useConfigurationContext();
  const isMobile = useIsMobile();
  const record = useRecordContext<Deal>();
  if (!record) return null;

  const closingLabel = formatISODateString(record.expected_closing_date);
  const startLabel = formatISODateString(record.start_date);
  const deliveryLabel = formatISODateString(record.delivery_date);
  const isFinished = record.stage === "won" || record.stage === "lost";
  const durationDays =
    isFinished && !record.delivery_date
      ? null
      : getDealDurationDays(record.start_date, record.delivery_date);
  // Day-level comparison in the local timezone: a deal closing today is not
  // "past" (new Date("YYYY-MM-DD") parses as UTC midnight, which incorrectly
  // flagged today's deals for almost the whole day).
  const closingIsPast = isBeforeToday(record.expected_closing_date);
  const clientUpdateLabel = formatTimestampDate(record.client_updated_at);
  // Three weeks of silence on live work is the thing a client complains about,
  // so it is marked like an overdue date rather than shown as a neutral fact.
  const clientUpdateIsStale =
    !isFinished &&
    (!record.client_updated_at ||
      Date.now() - new Date(record.client_updated_at).getTime() >
        21 * 86_400_000);
  const amountLabel =
    record.amount != null && record.amount > 0
      ? record.amount.toLocaleString("nl-NL", {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {record.archived_at ? <ArchivedBanner /> : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar />
          </ReferenceField>
          <div className="min-w-0">
            <p className="truncate text-meta text-ink-3">
              <ReferenceField
                source="company_id"
                reference="companies"
                link="show"
              />
            </p>
            <h2 className="text-title text-ink">{record.name}</h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {record.archived_at ? (
            <>
              <UnarchiveButton record={record} redirectTo={closeTo} />
              <DeleteButton confirm />
            </>
          ) : (
            <>
              <ArchiveButton record={record} redirectTo={closeTo} />
              {/* The desktop EditButton navigates to /deals/:id, a route that
                  only exists in the desktop Admin. On mobile we edit in place
                  through a sheet instead. */}
              {isMobile ? (
                <MobileEditButton record={record} />
              ) : editTo ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={editTo}>
                    <Pencil className="size-4" />
                    {translate("ra.action.edit")}
                  </Link>
                </Button>
              ) : (
                <EditButton />
              )}
            </>
          )}
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          {record.description ? (
            <section>
              <h3 className="eyebrow mb-1">
                {translate("resources.deals.fields.description")}
              </h3>
              <p className="whitespace-pre-line text-body leading-6 text-ink-2">
                {record.description}
              </p>
            </section>
          ) : null}

          <section className="min-w-0">
            <DealSteps />
          </section>

          {record.archived_at ? null : <DealStatusUpdate />}

          <section className="min-w-0">
            <InfiniteListBase
              resource="deal_notes"
              filter={{ deal_id: record.id }}
              sort={{ field: "date", order: "DESC" }}
              perPage={25}
              disableSyncWithLocation
              storeKey={false}
              empty={<NoteCreate reference={"deals"} />}
            >
              <NotesIterator reference="deals" />
            </InfiniteListBase>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <dl className="panel grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Fact label={translate("resources.deals.fields.stage")}>
              {findDealLabel(dealStages, record.stage)}
            </Fact>
            <Fact label={translate("resources.deals.fields.amount")}>
              {amountLabel ?? (
                <span className="text-ink-3">
                  {translate("resources.deals.no_amount", { _: "NTB" })}
                </span>
              )}
            </Fact>
            <Fact
              label={translate("resources.deals.fields.expected_closing_date")}
              tone={closingIsPast ? "late" : undefined}
            >
              {closingLabel ?? (
                <span className="text-ink-3">
                  {translate("resources.deals.no_date", {
                    _: "Nog niet gepland",
                  })}
                </span>
              )}
            </Fact>
            {record.category ? (
              <Fact label={translate("resources.deals.fields.category")}>
                {dealCategories.find(
                  (category) => category.value === record.category,
                )?.label ?? record.category}
              </Fact>
            ) : null}
            {startLabel ? (
              <Fact
                label={translate("resources.deals.fields.start_date", {
                  _: "Startdatum",
                })}
              >
                {startLabel}
              </Fact>
            ) : null}
            {deliveryLabel ? (
              <Fact
                label={translate("resources.deals.fields.delivery_date", {
                  _: "Opleverdatum",
                })}
              >
                {deliveryLabel}
              </Fact>
            ) : null}
            {/* Whether the client knows where things stand is a fact about the
                deal, not a detail of the update panel below. */}
            <Fact
              label={translate("resources.deals.fields.client_updated_at", {
                _: "Klant geïnformeerd",
              })}
              tone={clientUpdateIsStale ? "late" : undefined}
            >
              {clientUpdateLabel ?? (
                <span className="text-ink-3">
                  {translate("resources.deals.client_update_never", {
                    _: "Nog niet",
                  })}
                </span>
              )}
            </Fact>
            {durationDays != null ? (
              <Fact
                label={translate("resources.deals.fields.duration", {
                  _: "Looptijd",
                })}
              >
                {translate("resources.deals.duration_days", {
                  smart_count: durationDays,
                  _: `${durationDays} ${durationDays === 1 ? "dag" : "dagen"}`,
                })}
              </Fact>
            ) : null}
            <div className="col-span-2">
              <dt className="eyebrow">
                {translate("resources.deals.fields.assignee_ids", {
                  _: "Toegewezen aan",
                })}
              </dt>
              <dd className="mt-1">
                <AssigneesField ids={record.assignee_ids} size={20} />
              </dd>
            </div>
          </dl>

          {record.contact_ids?.length ? (
            <section>
              <h3 className="eyebrow mb-1.5">
                {translate("resources.deals.fields.contact_ids")}
              </h3>
              <ReferenceArrayField
                source="contact_ids"
                reference="contacts_summary"
              >
                <ContactList />
              </ReferenceArrayField>
            </section>
          ) : null}

          {!record.archived_at ? (
            <>
              <MoneybirdDealSection record={record} />
              <InzyteDealSection record={record} />
            </>
          ) : null}

          <DealInboundEmail />
        </aside>
      </div>
    </div>
  );
};

const Fact = ({
  children,
  label,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "late";
}) => (
  <div className="min-w-0">
    <dt className="eyebrow">{label}</dt>
    <dd
      className={`num truncate text-body ${tone === "late" ? "text-late" : "text-ink"}`}
    >
      {children}
    </dd>
  </div>
);

const MobileEditButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setEditOpen(true)} size="sm" variant="outline">
        <Pencil className="size-4" />
        {translate("ra.action.edit")}
      </Button>
      <DealEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        dealId={record.id}
      />
    </>
  );
};

const ArchivedBanner = () => {
  const translate = useTranslate();
  return (
    <p className="rounded-md border border-wait/35 bg-wait-tint px-3 py-2 text-body font-medium text-wait">
      {translate("resources.deals.archived.title")}
    </p>
  );
};

const ArchiveButton = ({
  record,
  redirectTo,
}: {
  record: Deal;
  redirectTo?: string;
}) => {
  const translate = useTranslate();
  const [update] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          if (redirectTo) redirect(redirectTo);
          else redirect("list", "deals");
          notify("resources.deals.archived.success", {
            type: "info",
            undoable: false,
          });
          refresh();
        },
        onError: () => {
          notify("resources.deals.archived.error", { type: "error" });
        },
      },
    );
  };

  return (
    <Button onClick={handleClick} size="sm" variant="outline">
      <Archive className="size-4" />
      {translate("resources.deals.archived.action")}
    </Button>
  );
};

const UnarchiveButton = ({
  record,
  redirectTo,
}: {
  record: Deal;
  redirectTo?: string;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      if (redirectTo) redirect(redirectTo);
      else redirect("list", "deals");
      notify("resources.deals.unarchived.success", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("resources.deals.unarchived.error", { type: "error" });
    },
  });

  return (
    <Button onClick={() => mutate()} size="sm" variant="outline">
      <ArchiveRestore className="size-4" />
      {translate("resources.deals.unarchived.action")}
    </Button>
  );
};
