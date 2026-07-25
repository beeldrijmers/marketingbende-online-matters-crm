import type { Identifier } from "ra-core";

import { BOARD_PATH, DEAL_ATTENTION_PATH } from "../root/routes";

export { BOARD_PATH, DEAL_ATTENTION_PATH };

/**
 * The board keeps its dialogs in the query string (`?deal=`, `?edit=`, `?new=`)
 * because the list's own filters are stored per user rather than in the URL, and
 * ra-core rewrites the whole query string when it syncs filters. These helpers
 * add and remove those params without losing the rest.
 */
export type DashboardDealSelection = {
  ids: Identifier[];
  kind: "attention";
  label: string;
};

export const getDashboardDealSelectionPath = (
  _kind: DashboardDealSelection["kind"],
) => DEAL_ATTENTION_PATH;

export const getDashboardDealReturnPath = (path: string, search: string) => {
  const [pathname, pathQuery = ""] = path.split("?", 2);
  const params = new URLSearchParams(pathQuery);
  const currentParams = new URLSearchParams(search);
  currentParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  params.delete("deal");
  params.delete("edit");
  params.delete("new");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const getDashboardDealDetailPath = (
  returnPath: string,
  dealId: Identifier,
) => {
  const [path, query = ""] = returnPath.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("deal", String(dealId));
  params.delete("edit");
  params.delete("new");
  return `${path}?${params.toString()}`;
};

export const getDashboardDealEditPath = (
  returnPath: string,
  dealId: Identifier,
) => {
  const [path, query = ""] = returnPath.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("edit", String(dealId));
  params.delete("deal");
  params.delete("new");
  return `${path}?${params.toString()}`;
};

export const getDashboardDealCreatePath = (returnPath: string) => {
  const [path, query = ""] = returnPath.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("new", "1");
  params.delete("deal");
  params.delete("edit");
  return `${path}?${params.toString()}`;
};

export const isDealId = (value: unknown): value is Identifier =>
  (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
  (typeof value === "string" && /^\d+$/.test(value));

export const createDashboardDealSelection = (
  ids: Identifier[],
  kind: DashboardDealSelection["kind"],
  label: string,
): DashboardDealSelection => ({
  ids: [...new Set(ids.filter(isDealId))],
  kind,
  label,
});

export const getDashboardDealSelectionFilter = (
  selection: DashboardDealSelection | null,
): Record<string, string> =>
  selection
    ? { "id@in": `(${selection.ids.length ? selection.ids.join(",") : 0})` }
    : {};
