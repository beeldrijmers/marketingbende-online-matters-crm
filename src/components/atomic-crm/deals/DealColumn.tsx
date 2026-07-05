import { Droppable } from "@hello-pangea/dnd";

import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
}: {
  stage: string;
  deals: Deal[];
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const { dealStages, currency } = useConfigurationContext();
  return (
    <div className="flex flex-1 min-w-56 flex-col">
      <div className="flex flex-col items-center gap-1.5">
        <h3 className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
          {findDealLabel(dealStages, stage)}
        </h3>
        <p className="text-sm text-muted-foreground">
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
              "flex flex-col rounded-2xl mt-2 gap-2 border-2 border-dashed border-transparent p-1 pb-3 transition-colors duration-200 overflow-y-auto max-h-[calc(100dvh-17rem)] min-h-[16rem]",
              snapshot.isDraggingOver && "border-primary/40 bg-muted",
            )}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
