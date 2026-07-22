import { expect, test } from "./fixtures";

test.describe("attention pipeline", () => {
  test.beforeEach(async ({ createCompany, createDeal, createSales }) => {
    const sales = await createSales({
      email: "pipeline@example.com",
      first_name: "Pipeline",
      last_name: "Tester",
      password: "password",
    });

    // A completely empty CRM intentionally shows the onboarding checklist.
    // Seed one overdue deal so this scenario exercises the real dashboard,
    // its attention CTA, URL-stable filters and the quick phase action.
    const company = await createCompany({
      name: "Pipeline Test",
      salesId: sales.id,
    });
    await createDeal({
      companyId: company.id,
      name: "Pipeline verbeterdeal",
      nextTaskDueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      salesId: sales.id,
    });
  });

  test("opens its specialized pipeline from the dashboard", async ({
    isMobile,
    page,
  }) => {
    await page.goto("http://localhost:5175/");
    await page.getByLabel("E-mail").fill("pipeline@example.com");
    await page.getByRole("textbox", { name: "Wachtwoord" }).fill("password");
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(
      page.getByRole("tab", { name: "Vandaag", exact: true }),
    ).toBeVisible();

    // Historic assignment URLs remain useful but never reopen a separate
    // assignments page: the Dashboard is now the single workspace.
    await page.goto("http://localhost:5175/#/deals");
    await expect(page).toHaveURL(/#\/\?tab=workboard$/);
    await expect(
      page.getByRole("heading", {
        name: "Opdrachtenbord · van begin tot eind",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alle opdrachten", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("tab", { name: "Vandaag", exact: true }).click();
    const attentionHeading = page.getByRole("heading", {
      name: "Dit heeft je aandacht nodig",
    });
    const attentionSection = page
      .locator("section")
      .filter({ has: attentionHeading })
      .first();
    await expect(attentionHeading).toBeVisible();
    await attentionSection
      .getByRole("link", { name: "Werkbord", exact: true })
      .click();

    await expect(page).toHaveURL(/#\/\?tab=workboard&focus=attention$/);
    await expect(
      page.getByRole("heading", { name: "Aandacht-pipeline" }),
    ).toBeVisible();
    const filters = page.getByRole("group", {
      name: "Filter aandachtspipeline",
    });
    await expect(
      filters.getByRole("button", { name: /te laat/i }),
    ).toBeVisible();
    await expect(
      filters.getByRole("button", { name: /vandaag/i }),
    ).toBeVisible();
    await expect(
      filters.getByRole("button", { name: /niet gepland/i }),
    ).toBeVisible();
    const search = page.getByRole("searchbox", {
      name: "Zoek in aandachtspipeline",
    });
    await search.fill("Pipeline Test");
    await filters.getByRole("button", { name: /te laat/i }).click();
    await expect(page).toHaveURL(/filter=overdue/);
    await expect(page).toHaveURL(/q=Pipeline(?:\+|%20)Test/);
    await page.reload();
    await expect(search).toHaveValue("Pipeline Test");
    await expect(
      filters.getByRole("button", { name: /te laat/i }),
    ).toHaveAttribute("aria-pressed", "true");

    await page
      .getByRole("button", {
        name: "Fase wijzigen voor Pipeline verbeterdeal",
        exact: true,
      })
      .click();
    await page.getByRole("menuitemradio", { name: "Bezig" }).click();
    await expect(page.getByText("Verplaatst naar")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Volgende taak plannen voor Pipeline verbeterdeal",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        isMobile
          ? /wijzig direct de fase of plan een taak/i
          : /versleep een deal of gebruik fase/i,
      ),
    ).toBeVisible();
  });
});
