import { useListFilterContext, useTranslate } from "ra-core";

import { cn } from "@/lib/utils";

type CompletionScope = "active" | "all";

const completionScopeOptions: Array<{
  value: CompletionScope;
  label: string;
  fallback: string;
}> = [
  {
    value: "active",
    label: "resources.deals.completion_scope.active",
    fallback: "Alleen open werk",
  },
  {
    value: "all",
    label: "resources.deals.completion_scope.all",
    fallback: "Alle fasen",
  },
];

// The default shows the complete workflow, including the Klaar column.
// Users who only need current work can still collapse the historical column.
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

  return (
    <div className={cn("mt-auto flex h-9 items-center", className)}>
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {completionScopeOptions.map((option) => (
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
