import {
  createDashboardDealSelection,
  DASHBOARD_WORKBOARD_PATH,
  DEAL_ATTENTION_PATH,
  DEAL_BILLING_PATH,
  getDashboardDealCreatePath,
  getDashboardDealDetailPath,
  getDashboardDealEditPath,
  getDashboardDealReturnPath,
  getDashboardDealSelectionPath,
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
    expect(DASHBOARD_WORKBOARD_PATH).toBe("/?tab=workboard");
    expect(DEAL_ATTENTION_PATH).toBe("/?tab=workboard&focus=attention");
    expect(DEAL_BILLING_PATH).toBe("/?tab=workboard&focus=billing");
    expect(getDashboardDealSelectionPath("attention")).toBe(
      DEAL_ATTENTION_PATH,
    );
    expect(getDashboardDealSelectionPath("billing")).toBe(DEAL_BILLING_PATH);
  });

  it("keeps attention filters and search while opening and closing a deal", () => {
    const returnPath = getDashboardDealReturnPath(
      DEAL_ATTENTION_PATH,
      "?filter=today&q=voodoo&deal=12",
    );

    expect(returnPath).toBe(
      "/?tab=workboard&focus=attention&filter=today&q=voodoo",
    );
    expect(getDashboardDealDetailPath(returnPath, 42)).toBe(
      "/?tab=workboard&focus=attention&filter=today&q=voodoo&deal=42",
    );
    expect(getDashboardDealEditPath(returnPath, 42)).toBe(
      "/?tab=workboard&focus=attention&filter=today&q=voodoo&edit=42",
    );
    expect(getDashboardDealCreatePath(returnPath)).toBe(
      "/?tab=workboard&focus=attention&filter=today&q=voodoo&new=1",
    );
  });
});
