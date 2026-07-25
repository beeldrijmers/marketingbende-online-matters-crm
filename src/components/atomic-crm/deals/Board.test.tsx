import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Desktop } from "./Board.stories";

describe("Board", () => {
  it("names the page once and shows every stage without Trello numbering", async () => {
    await page.viewport(1440, 900);
    const screen = await render(<Desktop />);

    // One heading for the page; the stage columns are the level below it.
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Opdrachten" }))
      .toBeVisible();

    for (const stage of [
      "Nog niet bevestigd",
      "Inplannen",
      "Wacht op input",
      "Bezig",
      "Controle en livegang",
      "Te factureren",
      "Afgerond",
      "Vaste klanten",
    ]) {
      await expect
        .element(screen.getByRole("heading", { name: stage }))
        .toBeVisible();
    }

    // The focus switch replaces the old nested tab strip.
    await expect
      .element(screen.getByRole("button", { name: /Aandacht/ }))
      .toBeVisible();

    await expect.element(screen.getByText(/ASP Noard/)).toBeVisible();
  });
});
