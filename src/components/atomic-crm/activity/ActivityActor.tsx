/* eslint-disable react-refresh/only-export-components */
import {
  type Identifier,
  type RaRecord,
  useGetIdentity,
  useTranslate,
} from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { PartyBadge, SaleAvatar } from "../sales/SaleAvatar";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { Sale } from "../types";

/**
 * Central actor resolution for the activity feed.
 *
 * Every activity row answers "wie deed dit". The five renderers used to repeat
 * the same identity/name lookup inline; they now share these primitives so the
 * acting person (avatar + party-badge slot, "Jij" for your own actions) looks
 * identical everywhere and the resolved name never collapses to "" or "??".
 */

export interface ActorInfo {
  /** True when the acting sales person is the logged-in user. */
  isCurrentUser: boolean;
  /** Display name, never empty and never the raw "??" error marker. */
  name: string;
}

/**
 * Resolves an activity actor to `{ isCurrentUser, name }`.
 *
 * The name falls back to "een teamlid" while the sales record is loading, on
 * error, or when it is missing, so a sentence is always readable. For your own
 * actions it returns the shared "Jij" label.
 */
export function useActor(salesId?: Identifier): ActorInfo {
  const translate = useTranslate();
  const { identity, isPending } = useGetIdentity();
  const isCurrentUser =
    !isPending && salesId != null && identity?.id === salesId;
  const resolved = useGetSalesName(salesId, {
    enabled: !isCurrentUser && salesId != null,
  });
  const trimmed = resolved?.trim();
  const name = isCurrentUser
    ? translate("crm.ownership.you", { _: "U" })
    : trimmed && trimmed !== "??"
      ? trimmed
      : translate("crm.activity.someone", { _: "een teamlid" });
  return { isCurrentUser, name };
}

/** Name-only helper; never returns "" or "??". */
export function useActorName(salesId?: Identifier): string {
  return useActor(salesId).name;
}

const ActorAvatarFallback = ({ size }: { size: number }) => (
  <div
    className="bg-muted rounded-full shrink-0"
    style={{ width: size, height: size }}
  />
);

/**
 * Actor avatar for an activity row: resolves `salesId` via a batched
 * ReferenceField and renders the acting person's <SaleAvatar> plus the
 * (currently inert) party-badge slot. Placed next to the entity avatar so it is
 * clear at a glance who performed the action. Falls back to a neutral
 * placeholder while loading or when no actor is known, keeping the row aligned.
 */
export function ActivityActorAvatar({
  salesId,
  size = 20,
}: {
  salesId?: Identifier;
  size?: number;
}) {
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  if (salesId == null) {
    return <ActorAvatarFallback size={size} />;
  }

  const isCurrentUser = identity?.id != null && identity.id === salesId;
  const record: RaRecord = { id: `actor-${salesId}`, sales_id: salesId };

  return (
    <ReferenceField<RaRecord, Sale>
      source="sales_id"
      reference="sales"
      record={record}
      link={false}
      loading={<ActorAvatarFallback size={size} />}
      error={<ActorAvatarFallback size={size} />}
      empty={<ActorAvatarFallback size={size} />}
      render={({ referenceRecord }) =>
        referenceRecord ? (
          <span className="inline-flex items-center gap-1 shrink-0">
            <SaleAvatar
              sale={referenceRecord}
              size={size}
              title={
                isCurrentUser
                  ? translate("crm.ownership.you", { _: "U" })
                  : undefined
              }
            />
            <PartyBadge sale={referenceRecord} />
          </span>
        ) : (
          <ActorAvatarFallback size={size} />
        )
      }
    />
  );
}
