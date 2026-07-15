import type { Identifier } from "ra-core";

const STATE_KEY = "dashboardDealSelection";

export type DashboardDealSelection = {
  ids: Identifier[];
  label: string;
};

export type DashboardDealSelectionState = {
  [STATE_KEY]: DashboardDealSelection;
};

const isDealId = (value: unknown): value is Identifier =>
  (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
  (typeof value === "string" && /^\d+$/.test(value));

export const createDashboardDealSelectionState = (
  ids: Identifier[],
  label: string,
): DashboardDealSelectionState => ({
  [STATE_KEY]: {
    ids: [...new Set(ids.filter(isDealId))],
    label,
  },
});

export const readDashboardDealSelection = (
  state: unknown,
): DashboardDealSelection | null => {
  if (!state || typeof state !== "object" || !(STATE_KEY in state)) return null;
  const selection = (state as Record<string, unknown>)[STATE_KEY];
  if (!selection || typeof selection !== "object") return null;
  const { ids, label } = selection as Record<string, unknown>;
  if (!Array.isArray(ids) || typeof label !== "string") return null;
  const validIds = [...new Set(ids.filter(isDealId))];
  return validIds.length > 0 ? { ids: validIds, label } : null;
};

export const getDashboardDealSelectionFilter = (
  selection: DashboardDealSelection | null,
): Record<string, string> =>
  selection ? { "id@in": `(${selection.ids.join(",")})` } : {};
