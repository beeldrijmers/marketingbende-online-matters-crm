import { DEAL_ATTENTION_PATH } from "./dashboardDealSelection";
import { getDealDashboardRedirectPath } from "./dealDashboardRedirectPath";

describe("DealDashboardRedirect", () => {
  it("maps historic create, show and edit URLs to the board's dialog params", () => {
    expect(getDealDashboardRedirectPath("/deals", "")).toBe("/deals");
    expect(getDealDashboardRedirectPath("/deals/create", "")).toBe(
      "/deals?new=1",
    );
    expect(getDealDashboardRedirectPath("/deals/42/show", "")).toBe(
      "/deals?deal=42",
    );
    expect(getDealDashboardRedirectPath("/deals/42", "")).toBe(
      "/deals?edit=42",
    );
  });

  it("preserves useful filters on the legacy attention URL", () => {
    expect(
      getDealDashboardRedirectPath(
        "/deals/aandacht",
        "?filter=today&q=valora",
        DEAL_ATTENTION_PATH,
      ),
    ).toBe("/deals?focus=attention&filter=today&q=valora");
  });
});
