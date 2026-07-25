import { Droppable } from "@hello-pangea/dnd";
import type { Identifier } from "ra-core";

import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";
import { getDealWorkflow } from "./dealWorkflow";

/**
 * The rail above each column.
 *
 * The eight columns used to carry eight different hues (slate, blue, amber,
 * violet, cyan, emerald, green, fuchsia) which told you nothing — the colour
 * was decoration. Here one accent runs along the line and gets stronger as work
 * approaches "afgerond", so position and progress are the same signal. The
 * blocked stage is the deliberate exception: it steps out of the line, in amber.
 */
const railStyle = (
  position: number,
  lastPosition: number,
  blocked: boolean,
) => {
  if (blocked) return { backgroundColor: "var(--wait)" };
  const share = lastPosition > 0 ? position / lastPosition : 1;
  const accentShare = Math.round(18 + share * 82);
  return {
    backgroundColor: `color-mix(in oklab, var(--accent-base) ${accentShare}%, var(--line))`,
  };
};

export const DealColumn = ({
  attentionPipeline = false,
  detailBasePath,
  stage,
  deals,
  lastPosition = 0,
  position = 0,
  tasksByDeal,
  onMoveToStage,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  detailBasePath?: string;
  stage: string;
  deals: Deal[];
  /** Index of the last stage, used to spread the accent across the line. */
  lastPosition?: number;
  /** This stage's index in the line. */
  position?: number;
  tasksByDeal: Map<Identifier, Task[]>;
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
}) => {
  const { dealStages, currency } = useConfigurationContext();
  // A monthly fee and a one-off project are different units: adding them up
  // produced a column total that meant nothing. They are reported separately,
  // and a zero total is simply left out.
  const totals = deals.reduce(
    (sums, deal) => {
      if (!deal.amount) return sums;
      return deal.revenue_period === "maandelijks"
        ? { ...sums, recurring: sums.recurring + deal.amount }
        : { ...sums, oneOff: sums.oneOff + deal.amount };
    },
    { oneOff: 0, recurring: 0 },
  );
  const formatCompact = (amount: number) =>
    amount.toLocaleString("nl-NL", {
      notation: "compact",
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 1,
    });
  const amountLabel = [
    totals.recurring > 0 ? `${formatCompact(totals.recurring)} p/m` : null,
    totals.oneOff > 0 ? formatCompact(totals.oneOff) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Only genuinely urgent work is counted here: a late or due-today step. The
  // wider "needs attention" set (which includes every passed closing date) has
  // its own focus view and would otherwise light up every column header.
  const urgentCount = deals.filter((deal) => {
    const kind = getDealWorkflow(deal, tasksByDeal.get(deal.id) ?? []).kind;
    return kind === "overdue" || kind === "today";
  }).length;
  const blocked = stage === "on-hold";
  const label = findDealLabel(dealStages, stage) ?? stage;

  return (
    <section
      aria-label={label}
      className="flex h-full w-[15.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-line-subtle bg-sunken xl:w-[16.5rem]"
    >
      <span
        aria-hidden
        className="h-[3px] w-full shrink-0"
        style={railStyle(position, lastPosition, blocked)}
      />
      <header className="shrink-0 px-2.5 pb-2 pt-2.5">
        <div className="flex items-baseline gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold leading-5 text-ink">
            {label}
          </h3>
          <span className="num text-meta font-semibold text-ink-2">
            {deals.length}
          </span>
        </div>
        {amountLabel || urgentCount > 0 ? (
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="num min-w-0 truncate text-meta text-ink-3">
              {amountLabel}
            </span>
            {urgentCount > 0 ? (
              <span className="num ml-auto shrink-0 text-meta text-late">
                {urgentCount} urgent
              </span>
            ) : null}
          </div>
        ) : null}
      </header>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={cn(
              // overscroll-y-contain keeps a hovered column from trapping the
              // board's horizontal scroll, which made the columns past the fold
              // unreachable with a trackpad.
              "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-y-contain px-1.5 pb-1.5 [scrollbar-gutter:stable] transition-colors duration-1",
              snapshot.isDraggingOver && "bg-accent-quiet",
            )}
          >
            {deals.map((deal, index) => (
              <DealCard
                attentionPipeline={attentionPipeline}
                key={deal.id}
                deal={deal}
                detailBasePath={detailBasePath}
                index={index}
                openTasks={tasksByDeal.get(deal.id) ?? []}
                onMoveToStage={onMoveToStage}
                onPlanTask={onPlanTask}
              />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
};
