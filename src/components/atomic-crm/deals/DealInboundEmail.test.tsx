import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";

import type { Deal } from "../types";
import { DealInboundEmail } from "./DealInboundEmail";

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1000,
  category: "",
  company_id: 1,
  contact_ids: [],
  created_at: "2025-01-01T09:00:00.000Z",
  description: "",
  expected_closing_date: "2025-02-01",
  id: 42,
  index: 0,
  name: "Test deal",
  sales_id: 0,
  stage: "opportunity",
  updated_at: "2025-01-01T09:00:00.000Z",
  ...overrides,
});

describe("DealInboundEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the per-deal inbound address and copies it to the clipboard", async () => {
    vi.stubEnv("VITE_INBOUND_EMAIL", "abc123@inbound.example.com");
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    const screen = await render(
      <StoryWrapper>
        <RecordContextProvider value={buildDeal()}>
          <DealInboundEmail />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByText("deal-42@inbound.example.com"))
      .toBeInTheDocument();

    await screen
      .getByRole("button", { name: /deal-42@inbound.example.com/i })
      .click();

    expect(writeText).toHaveBeenCalledWith("deal-42@inbound.example.com");
  });

  it("renders nothing when VITE_INBOUND_EMAIL is not set", async () => {
    vi.stubEnv("VITE_INBOUND_EMAIL", "");

    const screen = await render(
      <StoryWrapper>
        <RecordContextProvider value={buildDeal()}>
          <DealInboundEmail />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    expect(screen.container.textContent).toBe("");
  });
});
