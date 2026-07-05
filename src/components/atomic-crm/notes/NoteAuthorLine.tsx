import { useGetIdentity, useGetManyAggregate, useTranslate } from "ra-core";

import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { PartyBadge, SaleAvatar } from "../sales/SaleAvatar";
import { saleFullName } from "../sales/party";
import type { ContactNote, DealNote, Sale } from "../types";

/**
 * Author line for a note: "van wie is wat".
 *
 * Renders the AUTHOR avatar (never the empty company avatar the old markup
 * used), the existing translated sentence (you_added / author_added), an
 * optional readable status label next to the coloured status dot, and the
 * shared party-badge slot.
 *
 * The author name is hardened: an empty or "??" name (a note still loading or
 * a deleted sale) renders "een teamlid" instead of a blank or "?? heeft een
 * notitie toegevoegd" sentence.
 */
export const NoteAuthorLine = ({
  note,
  showStatus,
  size = 20,
}: {
  note: ContactNote | DealNote;
  showStatus?: boolean;
  size?: number;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { noteStatuses } = useConfigurationContext();

  const salesId = note.sales_id;
  const isCurrentUser = salesId != null && salesId === identity?.id;

  const { data } = useGetManyAggregate<Sale>(
    "sales",
    { ids: salesId != null ? [salesId] : [] },
    { enabled: salesId != null },
  );
  const sale = data?.[0];

  const fullName = saleFullName(sale);
  const authorName =
    fullName && fullName !== "??"
      ? fullName
      : translate("resources.notes.unknown_author", { _: "een teamlid" });

  const sentence = isCurrentUser
    ? translate("resources.notes.you_added", {
        _: "U heeft een notitie toegevoegd",
      })
    : translate("resources.notes.author_added", {
        name: authorName,
        _: "%{name} heeft een notitie toegevoegd",
      });

  const statusLabel =
    showStatus && note.status
      ? noteStatuses?.find((s) => s.value === note.status)?.label
      : undefined;

  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <SaleAvatar sale={sale} size={size} />
      <span>{sentence}</span>
      <PartyBadge sale={sale} />
      {showStatus && note.status ? (
        <span className="inline-flex items-center">
          <Status status={note.status} />
          {statusLabel ? <span>{statusLabel}</span> : null}
        </span>
      ) : null}
    </span>
  );
};
