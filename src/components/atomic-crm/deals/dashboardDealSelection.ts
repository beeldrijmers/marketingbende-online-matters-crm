import type { Identifier } from "ra-core";

export const DEAL_ATTENTION_PATH = "/deals/aandacht";
export const DEAL_BILLING_PATH = "/deals/facturatie";

export type DashboardDealSelection = {
  ids: Identifier[];
  kind: "attention" | "billing";
  label: string;
};

export const getDashboardDealSelectionPath = (
  kind: DashboardDealSelection["kind"],
) => (kind === "attention" ? DEAL_ATTENTION_PATH : DEAL_BILLING_PATH);

export const getDashboardDealReturnPath = (path: string, search: string) => {
  const params = new URLSearchParams(search);
  params.delete("deal");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export const getDashboardDealDetailPath = (
  returnPath: string,
  dealId: Identifier,
) => {
  const [path, query = ""] = returnPath.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("deal", String(dealId));
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
