import jsonExport from "jsonexport/dist";
import {
  downloadCSV,
  InfiniteListBase,
  useGetIdentity,
  useListContext,
  useTranslate,
  type Exporter,
} from "ra-core";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { BulkDeleteButton } from "@/components/admin/bulk-delete-button";
import { BulkExportButton } from "@/components/admin/bulk-export-button";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SelectAllButton } from "@/components/admin/select-all-button";
import { SortButton } from "@/components/admin/sort-button";
import { Skeleton } from "@/components/ui/skeleton";

import type { Company, Contact, Sale, Tag } from "../types";
import { BulkTagButton } from "./BulkTagButton";
import { ContactEmpty } from "./ContactEmpty";
import { ContactImportButton } from "./ContactImportButton";
import {
  ContactListContent,
  ContactListContentMobile,
} from "./ContactListContent";
import {
  ContactListFilterSummary,
  ContactListFilter,
} from "./ContactListFilter";
import { PageHeader } from "../layout/PageHeader";
import { TopToolbar } from "../layout/TopToolbar";
import { InfinitePagination } from "../misc/InfinitePagination";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";

export const ContactList = () => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <List
      title={false}
      // The page identity lives in <PageHeader> inside the layout, so the list's
      // own floating toolbar row is switched off: one band, not two.
      disableHeader
      disableBreadcrumb
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
    >
      <ContactListLayoutDesktop />
    </List>
  );
};

const ContactListLayoutDesktop = () => {
  const translate = useTranslate();
  const { data, isPending, filterValues, total } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  // While loading, mirror the real layout with skeletons instead of a blank
  // page; ContactListContent already renders its own row skeletons while the
  // list is pending.
  if (isPending) return <ContactListSkeleton />;

  if (!data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <>
      <PageHeader
        title={translate("resources.contacts.name", { smart_count: 2 })}
        meta={
          total != null
            ? translate("crm.common.record_count", {
                smart_count: total,
                _: `${total} contacten`,
              })
            : null
        }
        actions={<ContactListActions />}
      />
      <div className="flex flex-row gap-6">
        <ContactListFilter />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="panel divide-y divide-line-subtle overflow-hidden">
            <ContactListContent />
          </div>
          <ListPagination />
        </div>
        <BulkActionsToolbar>
          <ContactBulkActionButtons />
        </BulkActionsToolbar>
      </div>
    </>
  );
};

const ContactListSkeleton = () => (
  <>
    <PageHeader title={<Skeleton className="h-6 w-40" />} />
    <div className="flex flex-row gap-6">
      {/* Same width as the ContactListFilter rail so nothing shifts. */}
      <div className="hidden w-[13.5rem] min-w-[13.5rem] flex-col gap-6 sm:flex">
        {Array.from({ length: 4 }, (_, section) => (
          <div key={section} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="panel overflow-hidden">
          <ContactListContent />
        </div>
      </div>
    </div>
  </>
);

const ContactBulkActionButtons = () => (
  <>
    <SelectAllButton />
    <BulkTagButton />
    <BulkExportButton />
    <BulkDeleteButton />
  </>
);

const ContactListActions = () => (
  <TopToolbar>
    <SortButton fields={["first_name", "last_name", "last_seen"]} />
    <ContactImportButton />
    <ExportButton exporter={exporter} />
    <CreateButton />
  </TopToolbar>
);

export const ContactListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
      queryOptions={{
        onError: () => {
          /* Disable error notification as ContactListLayoutMobile handles it */
        },
      }}
    >
      <ContactListLayoutMobile />
    </InfiniteListBase>
  );
};

const ContactListLayoutMobile = () => {
  const { isPending, data, error, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!isPending && !data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div>
      <MobileHeader>
        <ContactListFilter />
      </MobileHeader>
      <MobileContent>
        <ContactListFilterSummary />
        <ContactListContentMobile />
        {!error && (
          <div className="flex justify-center">
            <InfinitePagination />
          </div>
        )}
      </MobileContent>
    </div>
  );
};

const exporter: Exporter<Contact> = async (records, fetchRelatedRecords) => {
  const companies = await fetchRelatedRecords<Company>(
    records,
    "company_id",
    "companies",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");
  const tags = await fetchRelatedRecords<Tag>(records, "tags", "tags");

  const contacts = records.map((contact) => {
    const exportedContact = {
      ...contact,
      company:
        contact.company_id != null
          ? companies[contact.company_id].name
          : undefined,
      sales:
        contact.sales_id != null
          ? `${sales[contact.sales_id].first_name} ${sales[contact.sales_id].last_name}`
          : undefined,
      tags: contact.tags.map((tagId) => tags[tagId].name).join(", "),
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      email_fts: undefined,
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
      phone_fts: undefined,
    };
    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;
    return exportedContact;
  });
  return jsonExport(contacts, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "contacts");
  });
};
