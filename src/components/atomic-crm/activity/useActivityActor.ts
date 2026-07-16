import { type Identifier, useGetIdentity, useTranslate } from "ra-core";

import { useGetSalesName } from "../sales/useGetSalesName";
import {
  getExternalActivityAttribution,
  type ActivityAttribution,
} from "./activityAttribution";

export interface ActorInfo {
  /** True when the acting sales person is the logged-in user. */
  isCurrentUser: boolean;
  /** Display name, never empty and never the raw "??" error marker. */
  name: string;
}

/**
 * Resolves an activity actor to `{ isCurrentUser, name }`.
 *
 * A Trello sync uses a technical CRM owner for access control. Its external
 * author is therefore preferred over that owner, while real CRM actions keep
 * the existing current-user and team-member behaviour.
 */
export function useActor(
  salesId?: Identifier,
  attribution?: ActivityAttribution,
): ActorInfo {
  const translate = useTranslate();
  const { identity, isPending } = useGetIdentity();
  const externalAttribution = getExternalActivityAttribution(attribution ?? {});
  const isCurrentUser =
    !externalAttribution &&
    !isPending &&
    salesId != null &&
    identity?.id === salesId;
  const resolved = useGetSalesName(salesId, {
    enabled: !externalAttribution && !isCurrentUser && salesId != null,
  });
  const trimmed = resolved?.trim();
  const name = externalAttribution
    ? (externalAttribution.sourceAuthor ??
      translate("crm.activity.trello", { _: "Trello" }))
    : isCurrentUser
      ? translate("crm.ownership.you", { _: "U" })
      : trimmed && trimmed !== "??"
        ? trimmed
        : translate("crm.activity.someone", { _: "een teamlid" });
  return { isCurrentUser, name };
}

/** Name-only helper; never returns an empty name or raw error marker. */
export function useActorName(salesId?: Identifier): string {
  return useActor(salesId).name;
}
