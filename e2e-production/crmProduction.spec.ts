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

  // The board has its own page again.
  await page.goto("/#/deals", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/#\/deals$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Opdrachten" }),
  ).toBeVisible();

  for (const route of ["contacts", "companies", "tasks", "financieel"]) {
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`#/${route}`));
    await expect(page.locator("#main-content")).toBeVisible();
  }

  // Settings are intentionally permission-gated. Both an available settings
  // screen and an explicit access-denied route prove that routing/authz works.
  await page.goto("/#/settings", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/#\/(?:settings|access-denied)$/);
  await expect(page.locator("#main-content")).toBeVisible();

  // The dashboard is "Vandaag": deviations first.
  await page.goto("/#/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Vandaag" }),
  ).toBeVisible();

  await page.goto("/#/deals?focus=attention", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("button", { name: /te laat/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /vandaag/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /niet gepland/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Zoek in aandachtspipeline" }),
  ).toBeVisible();

  // Bookmarks from the previous information architecture keep working.
  for (const [route, expectedUrl] of [
    ["deals/aandacht", /#\/deals\?focus=attention$/],
    ["deals/facturatie", /#\/financieel$/],
    ["?tab=workboard", /#\/deals$/],
    ["?tab=updates", /#\/updates$/],
  ] as const) {
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(expectedUrl);
    await expect(page.locator("#main-content")).toBeVisible();
  }

  expect(pageErrors, "uncaught browser errors").toEqual([]);
  expect(serverErrors, "HTTP 5xx responses").toEqual([]);
});
