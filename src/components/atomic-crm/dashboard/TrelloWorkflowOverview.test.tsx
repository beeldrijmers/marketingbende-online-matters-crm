import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Desktop } from "./TrelloWorkflowOverview.stories";

describe("TrelloWorkflowOverview", () => {
  it("renders the complete numbered workflow and distinguishes visible totals", async () => {
    await page.viewport(1440, 900);
    const screen = await render(<Desktop />);

    await expect
      .element(
        screen.getByRole("heading", {
          name: "Opdrachtenbord · van begin tot eind",
        }),
      )
      .toBeVisible();

    for (const stage of ["00", "10", "20", "30", "40", "50", "60", "70"]) {
      await expect
        .element(screen.getByRole("heading", { name: new RegExp(`^${stage}`) }))
        .toBeVisible();
    }

    await expect
      .element(
        screen.getByText("10 van 49 opdrachten zichtbaar", { exact: false }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("90 · Naslag/templates · 4"))
      .toBeVisible();
    await expect.element(screen.getByText(/ASP Noard/)).toBeVisible();
  });
});
