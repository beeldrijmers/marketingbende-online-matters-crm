import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { DashboardStepper } from "./DashboardStepper";

describe("DashboardStepper", () => {
  beforeEach(async () => {
    // Desktop layout: the note step renders a link instead of a sheet trigger.
    await page.viewport(1280, 800);
  });

  afterEach(async () => {
    // Restore the Vitest browser default so other suites keep mobile behavior.
    await page.viewport(414, 896);
  });

  it("renders a truly disabled note button when there is no contact yet", async () => {
    const screen = await render(
      <StoryWrapper>
        <DashboardStepper step={1} />
      </StoryWrapper>,
    );

    const addNote = screen.getByRole("button", { name: "Add note" });
    await expect.element(addNote).toBeDisabled();
    // Regression: the old markup linked to /contacts/undefined/show.
    expect(document.querySelector('a[href*="undefined"]')).toBeNull();
  });

  it("links to the given contact once the contact step is done", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact({ id: 42 })] }}>
        <DashboardStepper step={2} contactId={42} />
      </StoryWrapper>,
    );

    const addNote = screen.getByRole("link", { name: "Add note" });
    await expect.element(addNote).toHaveAttribute("href", "/contacts/42/show");
  });

  it("does not show a numeric progress fraction", async () => {
    const screen = await render(
      <StoryWrapper>
        <DashboardStepper step={1} />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("What's next?")).toBeInTheDocument();
    await expect.element(screen.getByText(/\/3 done/)).not.toBeInTheDocument();
  });
});
