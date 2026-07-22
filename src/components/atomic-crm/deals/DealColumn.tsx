import { Droppable } from "@hello-pangea/dnd";
import type { Identifier } from "ra-core";

import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

const stageTone: Record<string, { border: string; dot: string }> = {
  "informatie-pipeline": {
    border: "border-t-slate-500",
    dot: "bg-slate-500",
  },
  "bevestigd-inplannen": {
    border: "border-t-blue-500",
    dot: "bg-blue-500",
  },
  "on-hold": { border: "border-t-amber-500", dot: "bg-amber-500" },
  bezig: { border: "border-t-violet-500", dot: "bg-violet-500" },
  "controle-livegang": {
    border: "border-t-cyan-500",
    dot: "bg-cyan-500",
  },
  "facturatie-live": {
    border: "border-t-emerald-500",
    dot: "bg-emerald-500",
  },
  won: { border: "border-t-green-600", dot: "bg-green-600" },
  maandelijks: {
    border: "border-t-fuchsia-500",
    dot: "bg-fuchsia-500",
  },
};

const fallbackTone = {
  border: "border-t-muted-foreground",
  dot: "bg-muted-foreground",
};

export const DealColumn = ({
  attentionPipeline = false,
  detailBasePath,
  stage,
  deals,
  tasksByDeal,
  onMoveToStage,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  detailBasePath?: string;
  stage: string;
  deals: Deal[];
  tasksByDeal: Map<Identifier, Task[]>;
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const { dealStages, currency } = useConfigurationContext();
  const tone = stageTone[stage] ?? fallbackTone;
  return (
    <div
      className={cn(
        "flex h-full w-72 min-w-72 flex-none flex-col overflow-hidden rounded-xl border border-t-4 bg-muted/30 shadow-sm",
        tone.border,
        attentionPipeline && "bg-muted/20",
      )}
    >
      <div className="flex min-h-14 shrink-0 items-start gap-2 border-b bg-card/55 px-3 py-2.5">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot)} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5 text-foreground">
            {findDealLabel(dealStages, stage)}
          </h3>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {totalAmount.toLocaleString("nl-NL", {
              notation: "compact",
              style: "currency",
              currency,
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {deals.length}
        </span>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain border-2 border-dashed border-transparent p-2 [scrollbar-gutter:stable] transition-colors duration-200",
              attentionPipeline && "p-2",
              snapshot.isDraggingOver && "border-primary/40 bg-muted",
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
    </div>
  );
};
