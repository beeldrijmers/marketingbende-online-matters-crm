import { expect, test } from "./fixtures";

test.describe("user adding a task", () => {
  test.beforeEach(async ({ createSales, createContact, createCompany }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    const company = await createCompany({
      name: "Smith Corp",
      salesId: sales.id,
    });

    await createContact({
      first_name: "Jane",
      last_name: "Smith",
      title: "CEO",
      sales_id: sales.id,
      company_id: company.id,
      notes: [{ text: "Met at a conference." }],
    });

    await createContact({
      first_name: "Bob",
      last_name: "Johnson",
      title: "CTO",
      sales_id: sales.id,
      company_id: company.id,
    });

    await createContact({
      first_name: "Alice",
      last_name: "Williams",
      title: "CFO",
      sales_id: sales.id,
      company_id: company.id,
    });
  });
  test("user adding a task", async ({ page, isMobile, menu, dismissToast }) => {
    await page.goto("http://localhost:5175/");
    await page.getByLabel("E-mail").fill("john@doe.com");
    await page.getByLabel("Wachtwoord").fill("password");
    await page.getByRole("button", { name: "Inloggen" }).click();

    await expect(page).toHaveTitle(/BANKAI CRM/);
    await expect(page.getByText("Laatste activiteit")).toBeVisible();

    await menu.goToContacts();
    await page.waitForLoadState("networkidle");

    await page.getByText("Jane Smith").click();
    await page.waitForLoadState("networkidle");

    if (isMobile) {
      await page.getByRole("button", { name: "Toevoegen" }).click();
      await page.getByRole("menuitem", { name: "Taak" }).click();
    } else {
      await page.getByRole("button", { name: "Taak toevoegen" }).click();
    }
    await page.getByLabel("Omschrijving *").fill("Follow up with Jane");
    await page.getByLabel("Vervaldatum").fill("2026-04-11T21:00");
    await page.getByLabel("Type").click();
    await page.getByRole("option", { name: "Bellen" }).click();

    await page.getByRole("button", { name: "Opslaan" }).click();

    await dismissToast("Taak toegevoegd");

    if (isMobile) {
      await expect(page.getByText("1 taak")).toBeVisible();
      await page.getByText("1 taak").click();

      await expect(page.getByText("Follow up with Jane")).toBeVisible();
      // Due dates render date-only (no time); month formatting depends on
      // the active date locale, so match loosely.
      await expect(page.getByText(/verloopt .*2026/)).toBeVisible();
    } else {
      await expect(page.getByText("Taken")).toBeVisible();

      await expect(page.getByText("Taken").locator("..")).toHaveText(
        /Follow up with Jane/,
      );
      await menu.goToDashboard();

      await expect(page.getByText("Aankomende taken")).toBeVisible();
      await expect(
        page.getByText("Aankomende taken").locator("../.."),
      ).toHaveText(/Follow up with Jane/);
      // The task row also renders the assignee avatar + party badge (from the
      // collaboration layer) between the due date and the "(Betreft: ...)"
      // suffix, which the browser exposes as separate text nodes. Assert the
      // meaningful parts individually instead of the exact/whole-row text.
      const taskRow = page.getByText("Follow up with Jane").locator("..");
      await expect(taskRow).toContainText("Bellen");
      await expect(taskRow).toContainText("Follow up with Jane");
      await expect(taskRow).toContainText(/verloopt .*2026/);
      await expect(taskRow).toContainText("(Betreft: Jane Smith)");
    }
  });
});
