import { useListFilterContext, useTranslate } from "ra-core";

import { cn } from "@/lib/utils";

// A three-way segmented control that filters the board between all deals,
// internal work (Happr/own projects) and external client work. Kept dead
// simple: one tap to switch. Backed by the `is_internal` list filter.
type Scope = "all" | "internal" | "external";

export const InternalExternalInput = (_: {
  alwaysOn: boolean;
  source: string;
}) => {
  const translate = useTranslate();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();

  const current: Scope =
    filterValues.is_internal === true
      ? "internal"
      : filterValues.is_internal === false
        ? "external"
        : "all";

  const select = (scope: Scope) => {
    const next = { ...filterValues };
    if (scope === "all") {
      delete next.is_internal;
    } else {
      next.is_internal = scope === "internal";
    }
    setFilters(next, displayedFilters);
  };

  const options: { value: Scope; label: string; fallback: string }[] = [
    { value: "all", label: "resources.deals.scope.all", fallback: "Alles" },
    {
      value: "internal",
      label: "resources.deals.scope.internal",
      fallback: "Intern",
    },
    {
      value: "external",
      label: "resources.deals.scope.external",
      fallback: "Extern",
    },
  ];

  return (
    <div className="mt-auto pb-2">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={current === option.value}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              current === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {translate(option.label, { _: option.fallback })}
          </button>
        ))}
      </div>
    </div>
  );
};
