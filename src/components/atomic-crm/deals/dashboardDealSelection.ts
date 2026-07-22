import type { Identifier } from "ra-core";

export const DASHBOARD_WORKBOARD_PATH = "/?tab=workboard";
export const DEAL_ATTENTION_PATH = "/?tab=workboard&focus=attention";
export const DEAL_BILLING_PATH = "/?tab=workboard&focus=billing";

// Kept as redirects so bookmarks and links in older emails remain useful.
export const LEGACY_DEAL_ATTENTION_PATH = "/deals/aandacht";
export const LEGACY_DEAL_BILLING_PATH = "/deals/facturatie";

export type DashboardDealSelection = {
  ids: Identifier[];
  kind: "attention" | "billing";
  label: string;
};

export const getDashboardDealSelectionPath = (
  kind: DashboardDealSelection["kind"],
) => (kind === "attention" ? DEAL_ATTENTION_PATH : DEAL_BILLING_PATH);

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
