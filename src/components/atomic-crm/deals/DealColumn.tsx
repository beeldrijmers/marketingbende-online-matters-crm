import { Droppable } from "@hello-pangea/dnd";
import type { Identifier } from "ra-core";

import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
  tasksByDeal,
}: {
  stage: string;
  deals: Deal[];
  tasksByDeal: Map<Identifier, Task[]>;
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const { dealStages, currency } = useConfigurationContext();
  return (
    <div className="flex h-full min-w-56 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-center gap-2">
        <h3 className="rounded-full bg-muted px-3 py-0.5 text-sm font-semibold text-foreground">
          {findDealLabel(dealStages, stage)}
        </h3>
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
              snapshot.isDraggingOver && "border-primary/40 bg-muted",
            )}
          >
            {deals.map((deal, index) => (
              <DealCard
                key={deal.id}
                deal={deal}
                index={index}
                openTasks={tasksByDeal.get(deal.id) ?? []}
              />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
