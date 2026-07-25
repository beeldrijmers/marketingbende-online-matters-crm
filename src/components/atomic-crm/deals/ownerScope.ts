import type { Identifier } from "ra-core";

/**
 * Scoping the board to one person.
 *
 * The board can already be narrowed to "alleen van mij"; collaborating with
 * someone means also being able to look at *their* column of work, and at the
 * work nobody has claimed. Both live in the URL (`?owner=`) so a scoped board
 * can be linked to from the dashboard and shared in a message.
 */

/** Sentinel for deals without an owner — the gap Trello used to paper over. */
export const OWNER_UNASSIGNED = "none";

export type OwnerScope = string | null;

export const parseOwnerScope = (value: string | null): OwnerScope => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** The list filter for a scope, ready to merge into a `<List filter>`. */
export const ownerScopeFilter = (
  owner: OwnerScope,
): Record<string, unknown> => {
  if (!owner) return {};
  return owner === OWNER_UNASSIGNED
    ? { "sales_id@is": null }
    : { sales_id: owner };
};

/** The same rule, applied client-side (the attention view ranks in memory). */
export const filterByOwnerScope = <T extends { sales_id?: Identifier }>(
  records: T[],
  owner: OwnerScope,
): T[] => {
  if (!owner) return records;
  return owner === OWNER_UNASSIGNED
    ? records.filter((record) => record.sales_id == null)
    : records.filter((record) => String(record.sales_id) === String(owner));
};
