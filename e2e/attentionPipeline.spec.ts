import { expect, test } from "./fixtures";

test.describe("attention scope", () => {
  test.beforeEach(async ({ createCompany, createDeal, createSales }) => {
    const sales = await createSales({
      email: "pipeline@example.com",
      first_name: "Pipeline",
      last_name: "Tester",
      password: "password",
    });

    // A completely empty CRM intentionally shows the onboarding checklist.
    // Seed one overdue deal so this scenario exercises the real board, its
    // attention scope, the stable filters and the quick phase action.
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

  test("narrows the board to the work that needs a person", async ({
    isMobile,
    page,
  }) => {
    await page.goto("http://localhost:5175/");
    await page.getByLabel("E-mail").fill("pipeline@example.com");
    await page.getByRole("textbox", { name: "Wachtwoord" }).fill("password");
    await page.getByRole("button", { name: "Inloggen" }).click();

    // The board is its own page again.
    await page.goto("http://localhost:5175/#/deals");
    await expect(page).toHaveURL(/#\/deals$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Opdrachten" }),
    ).toBeVisible();

    if (isMobile) {
      // The phone shows one ranked list; the desktop scope switch is not part
      // of that screen.
      await expect(
        page.getByRole("searchbox", { name: /zoek/i }).first(),
      ).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("button", { name: "Alles", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Aandacht", exact: true }).click();
    await expect(page).toHaveURL(/#\/deals\?focus=attention$/);

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
  });
});
