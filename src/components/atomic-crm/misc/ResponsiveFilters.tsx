import { FilterLiveForm, useListContext, useTranslate } from "ra-core";
import { SearchInput, type SearchInputProps } from "@/components/admin";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

const FlexForm = (props: React.FormHTMLAttributes<HTMLFormElement>) => (
  <form className="flex-1" {...props} />
);

export const ResponsiveFilters = ({
  children,
  searchInput,
}: {
  children: React.ReactNode;
  searchInput?: Partial<SearchInputProps>;
}) => {
  const translate = useTranslate();
  const {
    source = "q",
    className,
    ...otherSearchInputProps
  } = searchInput || {};
  const isMobile = useIsMobile();
  const { setFilters, filterValues } = useListContext();

  // Count active filters excluding the search filter
  const activeFiltersCount = Object.entries(filterValues || {}).filter(
    ([key]) => key !== source,
  ).length;

  const handleClearFilters = () => {
    // Preserve only the search filter
    const searchValue = filterValues[source];
    const preservedFilters = searchValue ? { [source]: searchValue } : {};
    setFilters(preservedFilters, []);
  };

  if (isMobile) {
    return (
      <div className="flex flex-1 gap-2">
        <FilterLiveForm formComponent={FlexForm}>
          <SearchInput
            source={source}
            className={className}
            {...otherSearchInputProps}
          />
        </FilterLiveForm>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9"
              aria-label={translate("ra.action.add_filter")}
            >
              <Filter className="size-5" />
              {activeFiltersCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-dvh p-4 flex flex-col">
            <SheetHeader className="-p-4">
              <SheetTitle>
                <h1 className="text-xl font-semibold">
                  {translate("ra.action.add_filter")}
                </h1>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
              {children}
            </div>
            <SheetFooter className="-p-4 relative">
              <div className="absolute -top-12 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div className="flex w-full gap-4">
                <SheetClose asChild>
                  <Button
                    onClick={handleClearFilters}
                    type="button"
                    variant="secondary"
                    className="flex-1"
                  >
                    {translate("ra.navigation.clear_filters", {
                      _: "Filters wissen",
                    })}
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button className="flex-1">
                    {translate("ra.action.confirm")}
                  </Button>
                </SheetClose>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop rail: sticky, so filters stay reachable while a long list scrolls.
  return (
    <div className="order-first flex w-[13.5rem] min-w-[13.5rem] flex-col gap-4 self-start md:sticky md:top-[5.25rem]">
      <FilterLiveForm>
        <SearchInput source={source} {...otherSearchInputProps} />
      </FilterLiveForm>
      {children}
      {activeFiltersCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="justify-start px-2 text-meta text-ink-3 hover:text-ink"
        >
          {translate("ra.navigation.clear_filters", { _: "Filters wissen" })}
          <Badge
            variant="secondary"
            className="num ml-1 px-1.5 py-0 text-eyebrow tracking-normal"
          >
            {activeFiltersCount}
          </Badge>
        </Button>
      ) : null}
    </div>
  );
};
