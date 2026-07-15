import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleDot,
  Clock3,
  ListTodo,
  MoveRight,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: {
  counts: DealAttentionCounts;
  filter: AttentionPipelineFilter;
  mobile?: boolean;
  onFilterChange: (filter: AttentionPipelineFilter) => void;
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
          <Badge variant="secondary" className="tabular-nums">
            {counts.total} {counts.total === 1 ? "deal" : "deals"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {mobile
            ? "Open een deal om de fase te wijzigen. De urgentste staan bovenaan."
            : "Versleep deals naar de juiste volgende fase. De urgentste staan bovenaan."}
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

    <div
      aria-label="Filter aandachtspipeline"
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
