import type { Identifier } from "ra-core";

export const DEAL_ATTENTION_PATH = "/deals/aandacht";
export const DEAL_BILLING_PATH = "/deals/facturatie";

export type DashboardDealSelection = {
  ids: Identifier[];
  kind: "attention" | "billing";
  label: string;
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
