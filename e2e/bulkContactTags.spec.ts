import { test, expect } from "./fixtures";

test("user adds a tag to several contacts", async ({
  page,
  isMobile,
  createContact,
  createSales,
  menu,
  dismissToast,
}) => {
  test.skip(isMobile, "Bulk tag is only available on desktop");

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await createContact({
    first_name: "Ada",
    last_name: "Lovelace",
    sales_id: sales.id,
    title: "CTO",
  });
  await createContact({
    first_name: "Grace",
    last_name: "Hopper",
    sales_id: sales.id,
    title: "Rear Admiral",
  });

  await page.goto("http://localhost:5175/");

  await page.getByLabel("E-mail").fill("john@doe.com");
  await page.getByRole("textbox", { name: "Wachtwoord" }).fill("password");
  await page.getByRole("button", { name: "Inloggen" }).click();

  await expect(page).toHaveTitle(/BANKAI CRM/);
  // Contacts moved out of the top nav; confirm the app loaded via a nav link
  // that still exists.
  await expect(page.getByRole("link", { name: "Bedrijven" })).toBeVisible();

  await menu.goToContacts();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("Grace Hopper")).toBeVisible();

  const checkboxes = page.getByRole("checkbox");
  await checkboxes.nth(1).click();
  await page.getByRole("button", { name: /alles selecteren/i }).click();

  await page.getByRole("button", { name: /^Label$/ }).click();
  await page.getByRole("button", { name: "Nieuw label aanmaken" }).click();
  await page.getByLabel("Naam van label").fill("Prospect");
  await page.getByRole("button", { name: "Opslaan" }).click();

  await dismissToast("Label toegevoegd aan 2 contacten");

  await expect(
    page.getByText("Grace Hopper").locator("xpath=ancestor::a[1]"),
  ).toContainText("Prospect");
  await expect(
    page.getByText("Ada Lovelace").locator("xpath=ancestor::a[1]"),
  ).toContainText("Prospect");
});
