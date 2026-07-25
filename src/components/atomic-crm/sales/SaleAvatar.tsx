import type { RaRecord } from "ra-core";
import { useGetIdentity, useTranslate } from "ra-core";
import {
  AvatarFallback,
  AvatarImage,
  Avatar as ShadcnAvatar,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ReferenceField } from "@/components/admin/reference-field";
import { cn } from "@/lib/utils";

import type { Sale } from "../types";
import { getSaleParty, PARTY_META, saleFullName } from "./party";

/**
 * Shared owner/author presentation for the collaboration layer.
 *
 * Every place that answers "van wie is wat" (tasks, notes, activity, list
 * owner badges) renders through these primitives so ownership looks identical
 * across the app and the current user is always marked as "Jij".
 */

const initialsOf = (sale?: Partial<Sale> | null): string =>
  `${sale?.first_name?.charAt(0) ?? ""}${sale?.last_name?.charAt(0) ?? ""}`.toUpperCase();

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export const SaleAvatar = ({
  sale,
  size = 20,
  title,
}: {
  sale?: Partial<Sale> | null;
  size?: number;
  title?: string;
}) => {
  if (!sale?.avatar && !sale?.first_name && !sale?.last_name) {
    return null;
  }

  return (
    <ShadcnAvatar
      className="shrink-0"
      style={{ width: size, height: size }}
      title={title ?? saleFullName(sale)}
    >
      <AvatarImage src={sale.avatar?.src ?? undefined} />
      <AvatarFallback className={size < 32 ? "text-[10px]" : "text-sm"}>
        {initialsOf(sale)}
      </AvatarFallback>
    </ShadcnAvatar>
  );
};

// ---------------------------------------------------------------------------
// Party badge (inert until the party column exists)
// ---------------------------------------------------------------------------
export const PartyBadge = ({
  sale,
  className,
}: {
  sale?: Partial<Sale> | null;
  className?: string;
}) => {
  const translate = useTranslate();
  const party = getSaleParty(sale);
  if (!party) return null;
  const meta = PARTY_META[party];
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", meta.className, className)}
    >
      {translate(meta.labelKey, { _: meta.fallback })}
    </Badge>
  );
};

/**
 * The party as a coloured dot with an accessible name.
 *
 * Rows repeat the owner on every line, and a full outlined "Marketingbende"
 * pill on all of them turned into wallpaper. The dot keeps the identity signal
 * at a fraction of the ink.
 */
export const PartyDot = ({
  sale,
  className,
}: {
  sale?: Partial<Sale> | null;
  className?: string;
}) => {
  const translate = useTranslate();
  const party = getSaleParty(sale);
  if (!party) return null;
  const meta = PARTY_META[party];
  const label = translate(meta.labelKey, { _: meta.fallback });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        meta.dotClassName,
        className,
      )}
    />
  );
};

// ---------------------------------------------------------------------------
// Owner chip: avatar + name (+ party badge slot), marks the current user
// ---------------------------------------------------------------------------
export const OwnerChip = ({
  sale,
  size = 20,
  showParty = true,
  partyStyle = "dot",
  isCurrentUser,
  className,
}: {
  sale?: Partial<Sale> | null;
  size?: number;
  showParty?: boolean;
  partyStyle?: "dot" | "badge";
  isCurrentUser?: boolean;
  className?: string;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const self =
    isCurrentUser ??
    (sale?.id != null && identity?.id != null && identity.id === sale.id);
  const name = self
    ? translate("crm.ownership.you", { _: "U" })
    : saleFullName(sale) ||
      translate("crm.ownership.unknown", { _: "Onbekend" });

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <SaleAvatar sale={sale} size={size} />
      <span className="truncate">{name}</span>
      {/* A dot by default: rows repeat the owner on every line, and a full
          outlined party pill on each of them reads as wallpaper. */}
      {showParty ? (
        partyStyle === "badge" ? (
          <PartyBadge sale={sale} />
        ) : (
          <PartyDot sale={sale} />
        )
      ) : null}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Field wrapper: resolves a sales_id (batched via ReferenceField) then renders
// an OwnerChip. Drop-in for lists/cards that expose a `sales_id` on the record.
// ---------------------------------------------------------------------------
export const OwnerChipField = ({
  source = "sales_id",
  record,
  size,
  showParty,
  partyStyle,
  className,
}: {
  source?: string;
  record?: RaRecord;
  size?: number;
  showParty?: boolean;
  partyStyle?: "dot" | "badge";
  className?: string;
}) => (
  <ReferenceField<RaRecord, Sale>
    source={source}
    reference="sales"
    record={record}
    link={false}
    render={({ referenceRecord }) =>
      referenceRecord ? (
        <OwnerChip
          sale={referenceRecord}
          size={size}
          showParty={showParty}
          partyStyle={partyStyle}
          className={className}
        />
      ) : null
    }
  />
);
