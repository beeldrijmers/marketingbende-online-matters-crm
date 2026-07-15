import {
  createDashboardDealSelectionState,
  getDashboardDealSelectionFilter,
  readDashboardDealSelection,
} from "./dashboardDealSelection";

describe("dashboard deal selection", () => {
  it("creates an exact, deduplicated Kanban filter", () => {
    const state = createDashboardDealSelectionState(
      [12, 7, 12],
      "Facturatie afhandelen",
    );
    const selection = readDashboardDealSelection(state);

    expect(selection).toEqual({
      ids: [12, 7],
      label: "Facturatie afhandelen",
    });
    expect(getDashboardDealSelectionFilter(selection)).toEqual({
      "id@in": "(12,7)",
    });
  });

  it("ignores malformed navigation state", () => {
    expect(
      readDashboardDealSelection({
        dashboardDealSelection: {
          ids: [0, -1, "not-an-id"],
          label: "Ongeldig",
        },
      }),
    ).toBeNull();
    expect(getDashboardDealSelectionFilter(null)).toEqual({});
  });
});
