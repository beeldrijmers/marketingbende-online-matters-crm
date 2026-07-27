import {
  AlertTriangle,
  CalendarClock,
  CircleDot,
  Clock3,
  Hourglass,
  ListTodo,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { AttentionPipelineFilter } from "./dashboardDealKanbanModel";
import type { DealAttentionCounts } from "./dealWorkflow";

type FilterTone = "neutral" | "late" | "wait" | "quiet";

const filters: {
  key: AttentionPipelineFilter;
  label: string;
  icon: typeof CircleDot;
  count: (counts: DealAttentionCounts) => number;
  tone: FilterTone;
}[] = [
  {
    key: "all",
    label: "Alles",
    icon: CircleDot,
    count: (counts) => counts.total,
    tone: "neutral",
  },
  {
    key: "overdue",
    label: "Te laat",
    icon: AlertTriangle,
    count: (counts) => counts.overdue,
    tone: "late",
  },
  {
    key: "today",
    label: "Vandaag",
    icon: Clock3,
    count: (counts) => counts.today,
    tone: "wait",
  },
  {
    key: "planning",
    label: "Planning verlopen",
    icon: CalendarClock,
    count: (counts) => counts.planning,
    tone: "wait",
  },
  {
    key: "unplanned",
    label: "Niet gepland",
    icon: ListTodo,
    count: (counts) => counts.unplanned,
    tone: "quiet",
  },
  {
    key: "stalled",
    label: "Blijft liggen",
    icon: Hourglass,
    count: (counts) => counts.stalled,
    tone: "quiet",
  },
];

const activeTone: Record<FilterTone, string> = {
  neutral: "border-accent-line bg-accent-quiet text-ink",
  late: "border-late/45 bg-late-tint text-late",
  wait: "border-wait/45 bg-wait-tint text-wait",
  quiet: "border-line-strong bg-sunken text-ink",
};

/**
 * The attention view's own controls: search plus the deviation filters.
 *
 * This used to be a three-tier card with its own <h1>, subtitle and back
 * button, stacked underneath the dashboard's tabs — four headings before the
 * first card. The page header names the screen now; this is only the filter row.
 */
export const AttentionPipelineHeader = ({
  counts,
  filter,
  onFilterChange,
  onSearchChange,
  search,
  visibleCount,
}: {
  counts: DealAttentionCounts;
  embedded?: boolean;
  filter: AttentionPipelineFilter;
  mobile?: boolean;
  onFilterChange: (filter: AttentionPipelineFilter) => void;
  onSearchChange: (search: string) => void;
  search: string;
  visibleCount: number;
}) => (
  <div className="flex shrink-0 flex-wrap items-center gap-2">
    <div className="relative w-full max-w-72">
      <label htmlFor="attention-pipeline-search" className="sr-only">
        Zoek in aandachtspipeline
      </label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <Input
        id="attention-pipeline-search"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Zoek opdracht of klant"
        className="h-8 pl-8 pr-8 text-body"
      />
      {search ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Zoekopdracht wissen"
          className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
          onClick={() => onSearchChange("")}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>

    <div
      aria-label="Filter aandachtspipeline"
      role="group"
      className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
    >
      {filters.map((item) => {
        const Icon = item.icon;
        const active = item.key === filter;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(item.key)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-meta font-medium transition-colors duration-1",
              active
                ? activeTone[item.tone]
                : "border-line text-ink-2 hover:bg-raised hover:text-ink",
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
            <span className="num opacity-70">{item.count(counts)}</span>
          </button>
        );
      })}
    </div>

    <p className="shrink-0 text-meta text-ink-3 num" aria-live="polite">
      {visibleCount === counts.total
        ? `${counts.total} met aandachtspunt`
        : `${visibleCount} van ${counts.total}`}
    </p>
  </div>
);
