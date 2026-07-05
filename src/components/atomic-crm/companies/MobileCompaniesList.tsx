import {
  InfiniteListBase,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { InfinitePagination } from "../misc/InfinitePagination";
import { CompanyEmpty } from "./CompanyEmpty";
import { ImageList } from "./GridList";

/**
 * Mobile companies view: the desktop list has a filter sidebar next to the
 * grid, which does not fit a phone. On mobile the company card grid is shown
 * full-width (it reflows to a single column). Registered as the `companies`
 * list in the mobile Admin.
 */
export const MobileCompaniesList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <InfiniteListBase perPage={25} sort={{ field: "name", order: "ASC" }}>
      <CompaniesLayoutMobile />
    </InfiniteListBase>
  );
};

const CompaniesLayoutMobile = () => {
  const translate = useTranslate();
  const { data, isPending, error, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!isPending && !data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <div>
      <MobileHeader>
        <h1 className="text-lg font-semibold">
          {translate("resources.companies.name", { smart_count: 2 })}
        </h1>
      </MobileHeader>
      <MobileContent>
        <ImageList />
        {!error ? (
          <div className="flex justify-center mt-4">
            <InfinitePagination />
          </div>
        ) : null}
      </MobileContent>
    </div>
  );
};
