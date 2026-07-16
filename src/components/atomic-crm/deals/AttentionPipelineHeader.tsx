import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleDot,
  Clock3,
  ListTodo,
  MoveRight,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { DealAttentionCounts } from "./dealWorkflow";
import type { AttentionPipelineFilter } from "./dashboardDealKanbanModel";

const filters: Array<{
  key: AttentionPipelineFilter;
  label: string;
  icon: typeof CircleDot;
  count: (counts: DealAttentionCounts) => number;
  activeClassName: string;
}> = [
  {
    key: "all",
    label: "Alles",
    icon: CircleDot,
    count: (counts) => counts.total,
    activeClassName: "border-primary bg-primary text-primary-foreground",
  },
  {
    key: "overdue",
    label: "Te laat",
    icon: AlertTriangle,
    count: (counts) => counts.overdue,
    activeClassName:
      "border-destructive bg-destructive text-destructive-foreground",
  },
  {
    key: "today",
    label: "Vandaag",
    icon: Clock3,
    count: (counts) => counts.today,
    activeClassName:
      "border-amber-500 bg-amber-500 text-white dark:text-slate-950",
  },
  {
    key: "planning",
    label: "Planning verlopen",
    icon: CalendarClock,
    count: (counts) => counts.planning,
    activeClassName:
      "border-orange-500 bg-orange-500 text-white dark:text-slate-950",
  },
  {
    key: "unplanned",
    label: "Niet gepland",
    icon: ListTodo,
    count: (counts) => counts.unplanned,
    activeClassName:
      "border-violet-500 bg-violet-500 text-white dark:text-slate-950",
  },
];

export const AttentionPipelineHeader = ({
  counts,
  filter,
  mobile = false,
  onFilterChange,
  onSearchChange,
  search,
  visibleCount,
}: {
  counts: DealAttentionCounts;
  filter: AttentionPipelineFilter;
  mobile?: boolean;
  onFilterChange: (filter: AttentionPipelineFilter) => void;
  onSearchChange: (search: string) => void;
  search: string;
  visibleCount: number;
}) => (
  <section
    className={cn(
      "mb-3 overflow-hidden rounded-2xl border bg-card shadow-sm",
      mobile && "mx-4 mt-3",
    )}
  >
    <div
      className={cn("flex flex-wrap items-start gap-4 p-4", !mobile && "p-5")}
    >
      <div className="min-w-0 flex-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1 h-7 px-2 text-muted-foreground"
        >
          <Link to="/">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              "font-bold tracking-tight",
              mobile ? "text-xl" : "text-3xl",
            )}
          >
            Aandacht-pipeline
          </h1>
          <Badge
            variant="secondary"
            className="tabular-nums"
            aria-live="polite"
          >
            {visibleCount === counts.total
              ? `${counts.total} ${counts.total === 1 ? "deal" : "deals"}`
              : `${visibleCount} van ${counts.total}`}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {mobile
            ? "Wijzig direct de fase of plan een taak. De urgentste staan bovenaan."
            : "Versleep een deal of gebruik Fase. Plan de volgende taak zonder het bord te verlaten."}
        </p>
      </div>
      {!mobile ? (
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/deals">
            Volledige pipeline
            <MoveRight className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>

    <div className="border-t px-4 py-3">
      <label htmlFor="attention-pipeline-search" className="sr-only">
        Zoek in aandachtspipeline
      </label>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="attention-pipeline-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Zoek op deal, omschrijving of bedrijf…"
          className="pl-9 pr-10"
        />
        {search ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoekopdracht wissen"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
            onClick={() => onSearchChange("")}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>

    <div
      aria-label="Filter aandachtspipeline"
      role="group"
      className="flex gap-2 overflow-x-auto border-t bg-muted/25 px-4 py-3"
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
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && item.activeClassName,
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
            <span className="tabular-nums opacity-80">
              {item.count(counts)}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);
