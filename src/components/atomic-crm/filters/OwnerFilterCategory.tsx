import { UserRound } from "lucide-react";
import {
  useGetIdentity,
  useGetList,
  useListContext,
  useTranslate,
} from "ra-core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "./FilterCategory";
import { PartyBadge } from "../sales/SaleAvatar";
import { saleFullName } from "../sales/party";
import type { Sale } from "../types";

// Brand accent for the active owner toggle, layered over the button's own
// selected/secondary styling (mirrors CompanyListFilter's convention).
const activeFilterClassName =
  "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

/**
 * Shared three-state ownership filter for list sidebars.
 *
 * - "Alles": no `sales_id` filter (clears it).
 * - "Van mij": `{ sales_id: identity.id }`.
 * - Per colleague: `{ sales_id: sale.id }` with name + party badge.
 *
 * All three states share the single `sales_id` filter key, so selecting one
 * naturally deselects the others. Filter updates are immutable: a fresh copy
 * of the current filter values is produced on every change.
 */
export const OwnerFilterCategory = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { filterValues, setFilters, displayedFilters } = useListContext();
  const { data: sales } = useGetList<Sale>("sales", {
    filter: { "disabled@neq": true },
    sort: { field: "last_name", order: "ASC" },
    pagination: { page: 1, perPage: 100 },
  });

  const currentOwner = filterValues?.sales_id;
  const isAll = currentOwner == null;

  const clearOwner = () => {
    const nextFilters = { ...(filterValues ?? {}) };
    delete nextFilters.sales_id;
    setFilters(nextFilters, displayedFilters);
  };

  // The current user is represented by the dedicated "Van mij" toggle, so it
  // is left out of the colleague list to avoid a duplicate entry.
  const colleagues = (sales ?? []).filter((sale) => sale.id !== identity?.id);

  return (
    <FilterCategory
      icon={<UserRound className="h-4 w-4" />}
      label={translate("crm.ownership.filter.owner", { _: "Eigenaar" })}
    >
      <Button
        variant={isAll ? "secondary" : "ghost"}
        size="sm"
        onClick={clearOwner}
        className={cn(
          "cursor-pointer flex flex-row items-center justify-between gap-2 px-2.5 w-full",
          isAll && activeFilterClassName,
        )}
      >
        {translate("crm.ownership.filter.all", { _: "Alles" })}
      </Button>

      <ToggleFilterButton
        className={cn(
          "w-full justify-between",
          currentOwner != null &&
            currentOwner === identity?.id &&
            activeFilterClassName,
        )}
        label={translate("crm.ownership.filter.mine", { _: "Van mij" })}
        value={{ sales_id: identity?.id }}
      />

      {colleagues.map((sale) => (
        <ToggleFilterButton
          key={sale.id}
          className={cn(
            "w-full justify-between",
            currentOwner === sale.id && activeFilterClassName,
          )}
          label={
            <span className="inline-flex items-center gap-1.5">
              {saleFullName(sale)}
              <PartyBadge sale={sale} />
            </span>
          }
          value={{ sales_id: sale.id }}
        />
      ))}
    </FilterCategory>
  );
};
