import { getDealDashboardRedirectPath } from "./DealDashboardRedirect";
import {
  DEAL_ATTENTION_PATH,
  DEAL_BILLING_PATH,
} from "./dashboardDealSelection";

describe("DealDashboardRedirect", () => {
  it("maps historic list, create, show and edit URLs to dashboard state", () => {
    expect(getDealDashboardRedirectPath("/deals", "")).toBe("/?tab=workboard");
    expect(getDealDashboardRedirectPath("/deals/create", "")).toBe(
      "/?tab=workboard&new=1",
    );
    expect(getDealDashboardRedirectPath("/deals/42/show", "")).toBe(
      "/?tab=workboard&deal=42",
    );
    expect(getDealDashboardRedirectPath("/deals/42", "")).toBe(
      "/?tab=workboard&edit=42",
    );
  });

  it("preserves useful filters on legacy focused workboards", () => {
    expect(
      getDealDashboardRedirectPath(
        "/deals/aandacht",
        "?filter=today&q=valora",
        DEAL_ATTENTION_PATH,
      ),
    ).toBe("/?tab=workboard&focus=attention&filter=today&q=valora");
    expect(
      getDealDashboardRedirectPath("/deals/facturatie", "", DEAL_BILLING_PATH),
    ).toBe("/?tab=workboard&focus=billing");
  });
});
