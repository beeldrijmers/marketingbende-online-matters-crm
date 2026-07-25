import { Users } from "lucide-react";
import { useGetIdentity, useListContext, useTranslate } from "ra-core";
import { Link } from "react-router";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PageHeader } from "../layout/PageHeader";
import { TopToolbar } from "../layout/TopToolbar";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyListFilter } from "./CompanyListFilter";
import { ImageList } from "./GridList";

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <List
      title={false}
      // Identity and actions live in <PageHeader> below, inside the list
      // context, so the count can be live.
      disableHeader
      disableBreadcrumb
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      pagination={null}
    >
      <CompanyListLayout />
    </List>
  );
};

const CompanyListLayout = () => {
  const translate = useTranslate();
  const { data, isPending, filterValues, total } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  // While loading, mirror the real layout with skeletons (sidebar + card
  // grid) instead of a blank page; ImageList already renders its skeleton
  // grid while the list is pending.
  if (isPending) return <CompanyListSkeleton />;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <>
      <PageHeader
        title={translate("resources.companies.name", { smart_count: 2 })}
        meta={
          total != null
            ? translate("crm.common.record_count", {
                smart_count: total,
                _: `${total} bedrijven`,
              })
            : null
        }
        actions={<CompanyListActions />}
      />
      <div className="flex w-full flex-row gap-6">
        <CompanyListFilter />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <ImageList />
          <ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />
        </div>
      </div>
    </>
  );
};

const CompanyListSkeleton = () => (
  <>
    <PageHeader title={<Skeleton className="h-6 w-40" />} />
    <div className="flex w-full flex-row gap-6">
      {/* Same width as the CompanyListFilter rail so nothing shifts. */}
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
        <ImageList />
      </div>
    </div>
  </>
);

const CompanyListActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <Button asChild variant="outline" size="sm">
        <Link to="/contacts">
          <Users className="h-4 w-4" />
          {translate("resources.contacts.name", { smart_count: 2 })}
        </Link>
      </Button>
      <SortButton fields={["name", "created_at", "nb_contacts"]} />
      <ExportButton />
      <CreateButton
        label={translate("resources.companies.action.new", {
          _: "New Company",
        })}
      />
    </TopToolbar>
  );
};
