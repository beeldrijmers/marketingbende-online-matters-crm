import { test, expect } from "./fixtures";

test("user onboarding", async ({ page, isMobile, menu, dismissToast }) => {
  await page.goto("http://localhost:5175/?initial-setup=true");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/BANKAI CRM/);
  await expect(page.getByText("Welkom bij BANKAI CRM")).toBeVisible();

  await page.getByLabel("Voornaam").fill("John");
  await page.getByLabel("Achternaam").fill("Doe");
  await page.getByLabel("E-mail").fill("john@doe.com");
  await page.getByRole("textbox", { name: "Wachtwoord" }).fill("password");
  await page.getByRole("button", { name: "Account aanmaken" }).click();

  await expect(page.getByText("Wat nu?")).toBeVisible();
  await expect(page.getByText("BANKAI CRM installeren")).toBeVisible();
  await expect(page.getByText("Voeg uw eerste contact toe")).toBeVisible();
  await expect(page.getByText("Voeg uw eerste notitie toe")).toBeVisible();

  await page.getByText("Nieuw contact").click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Zij/Haar").click();
  await page.getByLabel("Voornaam").fill("Jane");
  await page.getByLabel("Achternaam").fill("Smith");
  await page.getByLabel("Functietitel").fill("CEO");
  await page.getByLabel("Bedrijf").click();
  await page.getByPlaceholder("Zoeken").fill("Smith Corp");
  await page.getByText("Smith Corp aanmaken").click();
  await page
    .getByRole("group", { name: "E-mailadressen" })
    .getByRole("textbox", { name: "E-mail" })
    .fill("jane@smithcorp.com");
  await page
    .getByRole("group", { name: "E-mailadressen" })
    .getByRole("button", { name: "Toevoegen" })
    .click();

  await page
    .getByRole("group", { name: "Telefoonnummers" })
    .getByRole("textbox", { name: "Telefoonnummer" })
    .fill("+1234567890");
  await page
    .getByRole("group", { name: "Telefoonnummers" })
    .getByRole("button", { name: "Toevoegen" })
    .click();

  await page
    .getByLabel("LinkedIn-URL")
    .fill("https://www.linkedin.com/in/jane-smith");

  await page
    .getByLabel("Achtergrondinformatie (bio, hoe u elkaar kent, etc.)")
    .fill("Met at a conference.");

  await page.getByLabel("Ontvangt nieuwsbrief").check();

  await expect(page.getByLabel("Accountmanager *")).toHaveText("John Doe");

  await page.getByRole("button", { name: "Opslaan" }).click();

  await dismissToast("Element toegevoegd");

  await expect(page.locator(isMobile ? "h2" : "h5")).toHaveText("Jane Smith");
  await expect(page.getByText("CEO bij Smith Corp")).toBeVisible();

  // The getting-started stepper only appears on an empty CRM, so once the first
  // contact exists it is gone. Add the first note from the contact's own notes
  // tab (empty state) instead of the old dashboard stepper button.
  await page.getByRole("button", { name: "Notitie toevoegen" }).click();

  await page.waitForLoadState("networkidle");

  await page
    .getByPlaceholder("Voeg een notitie toe")
    .fill("This is a note about Jane.");
  await page
    .getByRole("button", {
      name: isMobile ? "Opslaan" : "Deze notitie toevoegen",
    })
    .click();

  await dismissToast("Notitie toegevoegd");

  await expect(page.getByText("This is a note about Jane.")).toBeVisible();

  await menu.goToDashboard();

  await page.waitForLoadState("networkidle");

  await page.getByRole("tab", { name: "Updates", exact: true }).click();
  const activitySection = page.getByRole("tabpanel", {
    name: "Updates",
    exact: true,
  });
  await expect(activitySection).toBeVisible();
  await expect(activitySection).toContainText(
    /U heeft een bedrijf toegevoegd Smith Corp vandaag om/,
  );

  await expect(activitySection).toContainText(
    /U heeft toegevoegd Jane Smith aan Smith Corp vandaag om/,
  );

  await expect(activitySection).toContainText(
    /U heeft een notitie toegevoegd over Jane Smith vandaag om/,
  );
});
