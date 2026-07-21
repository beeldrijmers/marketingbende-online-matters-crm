import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { i18nProvider } from "../providers/commons/i18nProvider";
import { DashboardWorkspace } from "./DashboardWorkspace";

describe("DashboardWorkspace", () => {
  it("keeps the existing CRM functions reachable through clear dashboard views", async () => {
    const screen = await render(
      <StoryWrapper i18nProvider={i18nProvider}>
        <DashboardWorkspace hasDeals={false} />
      </StoryWrapper>,
    );

    for (const label of [
      "Werkbord",
      "Vandaag",
      "Updates",
      "Financieel",
      "Koppelingen",
    ]) {
      await expect
        .element(screen.getByRole("tab", { name: label }))
        .toBeVisible();
    }

    await screen.getByRole("tab", { name: "Vandaag" }).click();
    await expect
      .element(screen.getByText("Dit heeft je aandacht nodig"))
      .toBeVisible();

    await screen.getByRole("tab", { name: "Financieel" }).click();
    await expect
      .element(screen.getByText("Facturatie afhandelen"))
      .toBeVisible();

    await screen.getByRole("tab", { name: "Koppelingen" }).click();
    await expect
      .element(screen.getByRole("heading", { name: "Koppelingen" }))
      .toBeVisible();
  });
});
