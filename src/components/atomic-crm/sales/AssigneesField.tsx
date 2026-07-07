import type { Identifier } from "ra-core";
import { useGetIdentity, useGetManyAggregate, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { PartyKey, Sale } from "../types";
import { getSaleParty, PARTY_META, saleFullName } from "./party";
import { SaleAvatar } from "./SaleAvatar";

/**
 * The people assigned to a deal ("deelnemers"), rendered as a compact row of
 * overlapping avatars plus one badge per distinct collaborating party
 * (Marketingbende, Online Matters, ...). Hovering reveals every assignee by
 * name, with the current user marked as "Jij".
 *
 * This is the card/list counterpart of OwnerChip: a deal is visible to its
 * assignees, so the assignees - not just the single owner - are what the board
 * should show.
 */
export const AssigneesField = ({
  ids,
  size = 16,
  showParties = true,
  className,
}: {
  ids?: Identifier[];
  size?: number;
  // When false, only the avatars are shown (party names stay in the hover
  // tooltip) - used on the dense board cards to save a row.
  showParties?: boolean;
  className?: string;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  const assigneeIds = ids ?? [];
  const { data } = useGetManyAggregate<Sale>(
    "sales",
    { ids: assigneeIds },
    { enabled: assigneeIds.length > 0 },
  );

  if (!data) return null;

  // Resolve to sale records in the assignee order, dropping any that no longer
  // exist.
  const sales = assigneeIds
    .map((id) => data.find((sale) => String(sale.id) === String(id)))
    .filter((sale): sale is Sale => sale != null);
  if (sales.length === 0) return null;

  const label = (party: PartyKey) =>
    translate(PARTY_META[party].labelKey, { _: PARTY_META[party].fallback });
  const isSelf = (sale: Sale) =>
    identity?.id != null && String(identity.id) === String(sale.id);
  const nameOf = (sale: Sale) =>
    isSelf(sale)
      ? translate("crm.ownership.you", { _: "Jij" })
      : saleFullName(sale) ||
        translate("crm.ownership.unknown", { _: "Onbekend" });

  // One badge per distinct party, first-seen order.
  const parties = [
    ...new Set(
      sales
        .map(getSaleParty)
        .filter((party): party is PartyKey => party != null),
    ),
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5", className)}>
          <span className="flex -space-x-1.5">
            {sales.map((sale) => (
              <span
                key={sale.id}
                className="rounded-full ring-1 ring-background"
              >
                <SaleAvatar sale={sale} size={size} />
              </span>
            ))}
          </span>
          {showParties &&
            parties.map((party) => (
              <Badge
                key={party}
                variant="outline"
                className={PARTY_META[party].className}
              >
                {label(party)}
              </Badge>
            ))}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1.5 border bg-popover text-popover-foreground">
        {sales.map((sale) => {
          const party = getSaleParty(sale);
          return (
            <span key={sale.id} className="inline-flex items-center gap-1.5">
              <SaleAvatar sale={sale} size={18} />
              <span className="text-sm">{nameOf(sale)}</span>
              {party ? (
                <span className="text-xs text-muted-foreground">
                  {label(party)}
                </span>
              ) : null}
            </span>
          );
        })}
      </TooltipContent>
    </Tooltip>
  );
};
