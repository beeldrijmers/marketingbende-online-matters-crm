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
  await page.getByLabel(/password|wachtwoord/i).fill(password!);
  await page.getByRole("button", { name: /sign in|inloggen/i }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.locator("#main-content")).toBeVisible();

  for (const route of ["deals", "contacts", "companies", "settings"]) {
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`#/${route}`));
    await expect(page.locator("#main-content")).toBeVisible();
  }

  expect(pageErrors, "uncaught browser errors").toEqual([]);
  expect(serverErrors, "HTTP 5xx responses").toEqual([]);
});
