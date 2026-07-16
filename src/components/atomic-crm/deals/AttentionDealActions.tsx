import { CalendarPlus, Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

export const AttentionDealActions = ({
  compact = false,
  deal,
  onMoveToStage,
  onPlanTask,
}: {
  compact?: boolean;
  deal: Deal;
  onMoveToStage: (deal: Deal, destinationStage: string) => void;
  onPlanTask: (deal: Deal) => void;
}) => {
  const { dealStages } = useConfigurationContext();

  return (
    <div
      className={cn(
        "flex items-center gap-1 border-t pt-2",
        compact && "justify-end",
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            aria-label={`Fase wijzigen voor ${deal.name}`}
          >
            <Columns3 className="size-3.5" />
            Fase
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>Verplaats naar fase</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={deal.stage}
            onValueChange={(stage) => {
              if (stage !== deal.stage) onMoveToStage(deal, stage);
            }}
          >
            {dealStages.map((stage) => (
              <DropdownMenuRadioItem
                key={stage.value}
                value={stage.value}
                className="cursor-pointer"
              >
                {stage.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        aria-label={`Volgende taak plannen voor ${deal.name}`}
        onClick={() => onPlanTask(deal)}
      >
        <CalendarPlus className="size-3.5" />
        Taak
      </Button>
    </div>
  );
};
