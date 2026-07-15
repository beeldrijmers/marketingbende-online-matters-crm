import { ArrowRight, CalendarPlus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import type { Deal } from "../types";

export const AttentionMovePrompt = ({
  deal,
  destinationLabel,
  onDismiss,
}: {
  deal: Deal;
  destinationLabel: string;
  onDismiss: () => void;
}) => {
  const [taskOpen, setTaskOpen] = useState(false);

  return (
    <>
      <aside
        aria-live="polite"
        className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border bg-popover p-3 shadow-xl"
      >
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-semibold">{deal.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Verplaatst naar <ArrowRight className="size-3" /> {destinationLabel}
          </p>
        </div>
        <Button size="sm" onClick={() => setTaskOpen(true)}>
          <CalendarPlus className="size-4" />
          Volgende taak plannen
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Melding sluiten"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </Button>
      </aside>
      <TaskCreateSheet
        open={taskOpen}
        deal_id={deal.id}
        onOpenChange={(open) => {
          setTaskOpen(open);
          if (!open) onDismiss();
        }}
      />
    </>
  );
};
