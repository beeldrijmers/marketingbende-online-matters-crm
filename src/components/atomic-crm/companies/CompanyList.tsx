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
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <CompanyListLayout />
    </List>
  );
};

const CompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  // While loading, mirror the real layout with skeletons (sidebar + card
  // grid) instead of a blank page; ImageList already renders its skeleton
  // grid while the list is pending.
  if (isPending) return <CompanyListSkeleton />;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <div className="w-full flex flex-row gap-8">
      <CompanyListFilter />
      <div className="flex flex-col flex-1 gap-4">
        <ImageList />
      </div>
    </div>
  );
};

const CompanyListSkeleton = () => (
  <div className="w-full flex flex-row gap-8">
    {/* Same width as the CompanyListFilter sidebar so nothing shifts. */}
    <div className="w-52 min-w-52 flex-col gap-6 hidden sm:flex">
      {Array.from({ length: 4 }, (_, section) => (
        <div key={section} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
    <div className="flex flex-col flex-1 gap-4">
      <ImageList />
    </div>
  </div>
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
