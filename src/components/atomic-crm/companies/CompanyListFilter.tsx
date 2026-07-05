import { Building, Truck, Users } from "lucide-react";
import {
  FilterLiveForm,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { cn } from "@/lib/utils";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { SearchInput } from "@/components/admin/search-input";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

// Brand accent for the currently active toggle filter, layered over the
// button's own selected/secondary styling.
const activeFilterClassName =
  "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const { filterValues } = useListContext();
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="w-52 min-w-52 flex flex-col gap-6">
      <FilterLiveForm>
        <SearchInput source="q" />
      </FilterLiveForm>

      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label="resources.companies.fields.size"
      >
        {translatedSizes.map((size) => (
          <ToggleFilterButton
            className={cn(
              "w-full justify-between",
              filterValues.size === size.id && activeFilterClassName,
            )}
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Truck className="h-4 w-4" />}
        label="resources.companies.fields.sector"
      >
        {companySectors.map((sector) => (
          <ToggleFilterButton
            className={cn(
              "w-full justify-between",
              filterValues.sector === sector.value && activeFilterClassName,
            )}
            label={sector.label}
            key={sector.value}
            value={{ sector: sector.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="resources.companies.fields.sales_id"
      >
        <ToggleFilterButton
          className={cn(
            "w-full justify-between",
            !!identity &&
              filterValues.sales_id === identity.id &&
              activeFilterClassName,
          )}
          label={translate("crm.common.me")}
          value={{ sales_id: identity?.id }}
        />
      </FilterCategory>
    </div>
  );
};
