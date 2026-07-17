import { useListFilterContext, useTranslate } from "ra-core";

import { cn } from "@/lib/utils";

type CompletionScope = "active" | "all";

// Completed work stays available without taking over the operational board.
// The default view is active-only; one click restores the Klaar column.
export const CompletionScopeInput = ({
  className,
}: {
  alwaysOn?: boolean;
  className?: string;
  source?: string;
}) => {
  const translate = useTranslate();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const current: CompletionScope =
    filterValues["stage@neq"] === "won" ? "active" : "all";

  const select = (scope: CompletionScope) => {
    const next = { ...filterValues };
    if (scope === "active") next["stage@neq"] = "won";
    else delete next["stage@neq"];
    setFilters(next, displayedFilters);
  };

  const options: Array<{
    value: CompletionScope;
    label: string;
    fallback: string;
  }> = [
    {
      value: "active",
      label: "resources.deals.completion_scope.active",
      fallback: "Actief",
    },
    {
      value: "all",
      label: "resources.deals.completion_scope.all",
      fallback: "Inclusief klaar",
    },
  ];

  return (
    <div className={cn("mt-auto flex h-9 items-center", className)}>
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
