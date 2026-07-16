import { expect, test } from "@playwright/test";

const email = process.env.CRM_SMOKE_EMAIL;
const password = process.env.CRM_SMOKE_PASSWORD;

test("authenticated CRM dashboard and core routes stay operational", async ({
  page,
}) => {
  test.skip(!email || !password, "CRM smoke credentials are not configured");

  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/#/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/e-?mail/i).fill(email!);
  // The adjacent show-password button deliberately has an accessible label
  // containing "Wachtwoord" too, so target the form control unambiguously.
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole("button", { name: /sign in|inloggen/i }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.locator("#main-content")).toBeVisible();

  for (const route of ["deals", "contacts", "companies", "settings"]) {
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`#/${route}`));
    await expect(page.locator("#main-content")).toBeVisible();
  }

  await page.goto("/#/", { waitUntil: "domcontentloaded" });
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
    page.getByRole("searchbox", { name: "Zoek in aandachtspipeline" }),
  ).toBeVisible();

  for (const [route, label] of [
    ["deals/aandacht", "Aandacht-pipeline"],
    ["deals/facturatie", "Facturatie afhandelen"],
  ] as const) {
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`#/${route}$`));
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
  }

  expect(pageErrors, "uncaught browser errors").toEqual([]);
  expect(serverErrors, "HTTP 5xx responses").toEqual([]);
});
