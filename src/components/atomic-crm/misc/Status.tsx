import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * The relationship temperature (koud / warm / heet / in contract).
 *
 * The colour used to be the only carrier of meaning — a bare 10px dot with a
 * hand-rolled tooltip. It now has an accessible name and a real tooltip, so the
 * status survives both screen readers and colour-blind readers.
 */
export const Status = ({
  status,
  className,
}: {
  status: string;
  className?: string;
}) => {
  const { noteStatuses } = useConfigurationContext();
  if (!status || !noteStatuses) return null;
  const statusObject = noteStatuses.find((option) => option.value === status);
  if (!statusObject) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex shrink-0 items-center", className)}
          role="img"
          aria-label={statusObject.label}
        >
          <span
            aria-hidden
            className="size-2 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: statusObject.color }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{statusObject.label}</TooltipContent>
    </Tooltip>
  );
};
