import {
  createDashboardDealSelection,
  DEAL_ATTENTION_PATH,
  DEAL_BILLING_PATH,
  getDashboardDealSelectionFilter,
} from "./dashboardDealSelection";

describe("dashboard deal selection", () => {
  it("creates a validated, deduplicated permanent deal filter", () => {
    const selection = createDashboardDealSelection(
      [12, 4, 12, "9", "not-an-id", -1],
      "attention",
      "Dit heeft je aandacht nodig",
    );

    expect(selection).toEqual({
      ids: [12, 4, "9"],
      kind: "attention",
      label: "Dit heeft je aandacht nodig",
    });
    expect(getDashboardDealSelectionFilter(selection)).toEqual({
      "id@in": "(12,4,9)",
    });
  });

  it("keeps an empty dedicated view empty instead of showing every deal", () => {
    const selection = createDashboardDealSelection(
      [],
      "billing",
      "Facturatie afhandelen",
    );

    expect(getDashboardDealSelectionFilter(selection)).toEqual({
      "id@in": "(0)",
    });
  });

  it("uses dedicated, refresh-safe routes for both dashboard boards", () => {
    expect(DEAL_ATTENTION_PATH).toBe("/deals/aandacht");
    expect(DEAL_BILLING_PATH).toBe("/deals/facturatie");
  });
});
