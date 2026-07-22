import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import {
  InfiniteListBase,
  ShowBase,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { ContactList } from "./ContactList";
import { DealEditSheet } from "./DealEditSheet";
import { DealInboundEmail } from "./DealInboundEmail";
import { DealSteps } from "./DealSteps";
import { MoneybirdDocumentControl } from "./MoneybirdDocumentButtons";
import {
  findDealLabel,
  formatISODateString,
  getDealDurationDays,
  isBeforeToday,
} from "./dealUtils";

export const DealShow = ({
  closeTo = "/deals",
  editTo,
  open,
  id,
}: {
  closeTo?: string;
  editTo?: string;
  open: boolean;
  id?: string;
}) => {
  const navigate = useNavigate();
  const handleClose = () => {
    // Replace (not push) the detail entry with its originating board so the
    // browser back button lands before the dialog was opened instead of
    // reopening it. Works for deep links too, unlike navigate(-1).
    navigate(closeTo, { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0"
      >
        <DealDialogTitle />
        {id ? (
          <ShowBase id={id}>
            <DealShowContent closeTo={closeTo} editTo={editTo} />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const DealDialogTitle = () => {
  const translate = useTranslate();
  return (
    <DialogTitle className="sr-only">
      {translate("resources.deals.forcedCaseName")}
    </DialogTitle>
  );
};

const DealShowContent = ({
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
    <>
      <div className="space-y-2">
        {record.archived_at ? <ArchivedTitle /> : null}
        <div className="flex-1">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-8">
            <div className="flex items-center gap-4 flex-1 min-w-64">
              <ReferenceField
                source="company_id"
                reference="companies"
                link="show"
              >
                <CompanyAvatar />
              </ReferenceField>
              <h2 className="text-2xl font-semibold">{record.name}</h2>
            </div>
            <div className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}>
              {record.archived_at ? (
                <>
                  <UnarchiveButton record={record} redirectTo={closeTo} />
                  <DeleteButton />
                </>
              ) : (
                <>
                  <MoneybirdDocumentControl record={record} kind="estimate" />
                  <MoneybirdDocumentControl record={record} kind="invoice" />
                  <ArchiveButton record={record} redirectTo={closeTo} />
                  {/* The desktop EditButton navigates to /deals/:id, a route
                      that only exists in the desktop Admin. On mobile we edit
                      in place through a sheet instead. */}
                  {isMobile ? (
                    <MobileEditButton record={record} />
                  ) : editTo ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="flex h-9 items-center gap-2"
                    >
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
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-4 m-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.expected_closing_date")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {closingLabel ?? (
                    <span className="text-muted-foreground">
                      {translate("resources.deals.no_date", {
                        _: "Nog niet gepland",
                      })}
                    </span>
                  )}
                </span>
                {closingIsPast ? (
                  <Badge variant="destructive">
                    {translate("crm.common.past")}
                  </Badge>
                ) : null}
              </div>
            </div>

            {startLabel && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.start_date", {
                    _: "Startdatum",
                  })}
                </span>
                <span className="text-sm">{startLabel}</span>
              </div>
            )}

            {deliveryLabel && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.delivery_date", {
                    _: "Opleverdatum",
                  })}
                </span>
                <span className="text-sm">{deliveryLabel}</span>
              </div>
            )}

            {durationDays != null && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.duration", {
                    _: "Looptijd",
                  })}
                </span>
                <span className="text-sm">
                  {translate("resources.deals.duration_days", {
                    smart_count: durationDays,
                    _: `${durationDays} ${durationDays === 1 ? "dag" : "dagen"}`,
                  })}
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.amount")}
              </span>
              <span className="text-sm">
                {amountLabel ?? (
                  <span className="text-muted-foreground">
                    {translate("resources.deals.no_amount", {
                      _: "NTB",
                    })}
                  </span>
                )}
              </span>
            </div>

            {record.category && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.category")}
                </span>
                <span className="text-sm">
                  {dealCategories.find((c) => c.value === record.category)
                    ?.label ?? record.category}
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.stage")}
              </span>
              <span className="text-sm">
                {findDealLabel(dealStages, record.stage)}
              </span>
            </div>
          </div>

          {!!record.contact_ids?.length && (
            <div className="m-4">
              <div className="flex flex-col min-h-12 mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.contact_ids")}
                </span>
                <ReferenceArrayField
                  source="contact_ids"
                  reference="contacts_summary"
                >
                  <ContactList />
                </ReferenceArrayField>
              </div>
            </div>
          )}

          {record.description && (
            <div className="m-4 whitespace-pre-line">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.description")}
              </span>
              <p className="text-sm leading-6">{record.description}</p>
            </div>
          )}

          <div className="m-4">
            <Separator className="mb-4" />
            <DealSteps />
          </div>

          <div className="m-4">
            <DealInboundEmail />
          </div>

          <div className="m-4">
            <Separator className="mb-4" />
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
          </div>
        </div>
      </div>
    </>
  );
};

const MobileEditButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setEditOpen(true)}
        size="sm"
        variant="outline"
        className="flex items-center gap-2 h-9"
      >
        <Pencil className="w-4 h-4" />
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

const ArchivedTitle = () => {
  const translate = useTranslate();
  return (
    <div className="bg-orange-500 px-6 py-4">
      <h3 className="text-lg font-bold text-white">
        {translate("resources.deals.archived.title")}
      </h3>
    </div>
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
          notify("resources.deals.archived.error", {
            type: "error",
          });
        },
      },
    );
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <Archive className="w-4 h-4" />
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
      notify("resources.deals.unarchived.error", {
        type: "error",
      });
    },
  });

  const handleClick = () => {
    mutate();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <ArchiveRestore className="w-4 h-4" />
      {translate("resources.deals.unarchived.action")}
    </Button>
  );
};
