import { Droppable } from "@hello-pangea/dnd";
import type { Identifier } from "ra-core";

import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

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
  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col overflow-hidden",
        attentionPipeline ? "min-w-72" : "min-w-56",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          attentionPipeline ? "justify-start px-1" : "justify-center",
        )}
      >
        <h3
          className={cn(
            "rounded-full bg-muted px-3 py-0.5 text-sm font-semibold text-foreground",
            attentionPipeline && "bg-foreground text-background",
          )}
        >
          {findDealLabel(dealStages, stage)}
        </h3>
        {attentionPipeline ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {deals.length}
          </span>
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          {totalAmount.toLocaleString("nl-NL", {
            notation: "compact",
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3,
          })}
        </p>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={cn(
              "mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-2xl border-2 border-dashed border-transparent p-1 pb-3 [scrollbar-gutter:stable] transition-colors duration-200",
              attentionPipeline && "bg-muted/20 p-1.5",
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
