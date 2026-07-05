import {
  InfiniteListBase,
  RecordContextProvider,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { NumberField } from "@/components/admin/number-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { InfinitePagination } from "../misc/InfinitePagination";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { OwnerChipField } from "../sales/SaleAvatar";
import type { Deal } from "../types";
import { DealShow } from "./DealShow";

/**
 * Mobile deals view: the kanban board is desktop-only, so on mobile the deals
 * are shown as a tappable list (company, name, amount, stage, owner + party).
 * Registered as the `deals` list in the mobile Admin.
 */
export const MobileDealsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "created_at", order: "DESC" }}
    >
      <DealsLayoutMobile />
    </InfiniteListBase>
  );
};

const DealsLayoutMobile = () => {
  const translate = useTranslate();
  const location = useLocation();
  const { data, error, isPending } = useListContext<Deal>();

  // The deal detail is a URL-driven dialog (same pattern as the desktop board):
  // tapping a row navigates to /deals/:id/show, which this list matches and
  // opens over itself; closing redirects back to the list.
  const matchShow = matchPath("/deals/:id/show", location.pathname);

  return (
    <div>
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
      <MobileHeader>
        <h1 className="text-lg font-semibold">
          {translate("resources.deals.name", { smart_count: 2 })}
        </h1>
      </MobileHeader>
      <MobileContent>
        {!isPending && !error && data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.deals.empty", { _: "Nog geen deals" })}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {data?.map((deal) => (
            <RecordContextProvider key={deal.id} value={deal}>
              <MobileDealRow deal={deal} />
            </RecordContextProvider>
          ))}
        </div>
        {!error ? (
          <div className="flex justify-center mt-4">
            <InfinitePagination />
          </div>
        ) : null}
      </MobileContent>
    </div>
  );
};

const MobileDealRow = ({ deal }: { deal: Deal }) => {
  const { dealStages, currency } = useConfigurationContext();
  return (
    <Link to={`/deals/${deal.id}/show`} className="no-underline">
      <Card className="p-3 flex flex-col gap-1.5 transition-colors hover:bg-muted/60">
        <div className="flex items-center gap-2">
          <ReferenceField
            source="company_id"
            reference="companies"
            link={false}
          >
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>
          <span className="text-sm font-medium flex-1 truncate">
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            />
            {" - "}
            {deal.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            <NumberField
              source="amount"
              options={{
                notation: "compact",
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
                minimumSignificantDigits: 3,
              }}
              locales="nl-NL"
              empty="Geen bedrag"
            />
          </span>
          {deal.stage ? (
            <Badge variant="secondary" className="shrink-0">
              <SelectField
                source="stage"
                choices={dealStages}
                optionText="label"
                optionValue="value"
                empty={deal.stage}
              />
            </Badge>
          ) : null}
        </div>
        <OwnerChipField
          source="sales_id"
          record={deal}
          size={16}
          showParty
          className="text-xs text-muted-foreground"
        />
      </Card>
    </Link>
  );
};
