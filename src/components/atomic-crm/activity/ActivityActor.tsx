import {
  type Identifier,
  type RaRecord,
  useGetIdentity,
  useTranslate,
} from "ra-core";
import { Trello } from "lucide-react";

import { ReferenceField } from "@/components/admin/reference-field";
import { PartyBadge, SaleAvatar } from "../sales/SaleAvatar";
import type { Sale } from "../types";
import { getExternalActivityAttribution } from "./activityAttribution";

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
  source,
  sourceAuthor,
  size = 20,
}: {
  salesId?: Identifier;
  source?: string | null;
  sourceAuthor?: string | null;
  size?: number;
}) {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const externalAttribution = getExternalActivityAttribution({
    source,
    sourceAuthor,
  });

  if (externalAttribution) {
    const title =
      externalAttribution.sourceAuthor ??
      translate("crm.activity.trello", { _: "Trello" });
    return (
      <span
        aria-label={title}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300"
        style={{ width: size, height: size }}
        title={title}
      >
        <Trello
          style={{
            width: Math.max(12, size - 7),
            height: Math.max(12, size - 7),
          }}
        />
      </span>
    );
  }

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
