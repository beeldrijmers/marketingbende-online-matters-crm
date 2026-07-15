import { expect, test } from "./fixtures";

test.describe("attention pipeline", () => {
  test.beforeEach(async ({ createCompany, createSales }) => {
    const sales = await createSales({
      email: "pipeline@example.com",
      first_name: "Pipeline",
      last_name: "Tester",
      password: "password",
    });

    // A completely empty CRM intentionally shows the onboarding checklist.
    // Seed one company so this scenario exercises the real dashboard and its
    // attention-queue CTA without needing a deal to be present.
    await createCompany({ name: "Pipeline Test", salesId: sales.id });
  });

  test("opens its specialized pipeline from the dashboard", async ({
    isMobile,
    page,
  }) => {
    await page.goto("http://localhost:5175/");
    await page.getByLabel("E-mail").fill("pipeline@example.com");
    await page.getByRole("textbox", { name: "Wachtwoord" }).fill("password");
    await page.getByRole("button", { name: "Inloggen" }).click();

    const attentionHeading = page.getByRole("heading", {
      name: "Dit heeft je aandacht nodig",
    });
    const attentionSection = page
      .locator("section")
      .filter({ has: attentionHeading })
      .first();
    await expect(attentionHeading).toBeVisible();
    await attentionSection.getByRole("link", { name: /kanban/i }).click();

    await expect(page).toHaveURL(/#\/deals\/aandacht$/);
    await expect(
      page.getByRole("heading", { name: "Aandacht-pipeline" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /te laat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /vandaag/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /niet gepland/i }),
    ).toBeVisible();
    await expect(
      page.getByText(
        isMobile
          ? /open een deal om de fase te wijzigen/i
          : /versleep deals naar de juiste volgende fase/i,
      ),
    ).toBeVisible();
  });
});
