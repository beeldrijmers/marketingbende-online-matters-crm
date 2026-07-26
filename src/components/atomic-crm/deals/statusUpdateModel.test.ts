import { dealStages } from "../root/appConfiguration";
import type { Deal, Task } from "../types";
import { buildStatusUpdate } from "./statusUpdateModel";

const now = new Date("2026-07-26T09:00:00.000Z");

const deal = (overrides: Partial<Deal> = {}) =>
  ({
    client_updated_at: null,
    delivery_date: null,
    expected_closing_date: null,
    name: "Staging klaar, wacht op content",
    on_hold: false,
    stage: "controle-livegang",
    ...overrides,
  }) as Deal;

const step = (
  text: string,
  overrides: Partial<Task> = {},
): Pick<Task, "text" | "done_date" | "due_date"> => ({
  text,
  done_date: null,
  due_date: "2026-07-30",
  ...overrides,
});

const build = (input: Partial<Parameters<typeof buildStatusUpdate>[0]> = {}) =>
  buildStatusUpdate({
    companyName: "ASP Noard",
    deal: deal(),
    now,
    stages: dealStages,
    steps: [],
    ...input,
  });

describe("buildStatusUpdate", () => {
  it("says where we stand in the client's language, not in board labels", () => {
    const update = build({ deal: deal({ stage: "on-hold", on_hold: true }) });

    expect(update.body).toContain("De opdracht staat tijdelijk stil.");
    expect(update.body).toContain(
      "Zodra we van u horen, pakken we het direct weer op.",
    );
    // "Wacht op input" is how the team talks about it, not how a client reads it.
    expect(update.body).not.toContain("Wacht op input");
  });

  it("reports only the work finished since the previous update", () => {
    const update = build({
      deal: deal({ client_updated_at: "2026-07-20T09:00:00.000Z" }),
      steps: [
        step("oude taak van juni", { done_date: "2026-06-10T09:00:00.000Z" }),
        step("staging ingericht", { done_date: "2026-07-22T09:00:00.000Z" }),
        step("content nakijken"),
      ],
    });

    expect(update.completedSinceLastUpdate).toBe(1);
    expect(update.body).toContain("Gedaan sinds 20 juli");
    expect(update.body).toContain("- Staging ingericht.");
    expect(update.body).not.toContain("oude taak van juni");
    expect(update.body).toContain("- Content nakijken.");
  });

  it("falls back to the whole history for a first update", () => {
    const update = build({
      steps: [
        step("staging ingericht", { done_date: "2026-07-22T09:00:00.000Z" }),
      ],
    });

    expect(update.body).toContain("Wat er is gedaan");
    expect(update.completedSinceLastUpdate).toBe(1);
  });

  it("does not pretend a passed delivery date is still the plan", () => {
    const update = build({ deal: deal({ delivery_date: "2026-07-01" }) });

    expect(update.body).toContain("opleverdatum is verstreken");
    expect(update.body).not.toContain("1 juli 2026.");
  });

  it("names a future delivery date", () => {
    const update = build({ deal: deal({ delivery_date: "2026-08-14" }) });

    expect(update.body).toContain(
      "Oplevering staat gepland op 14 augustus 2026.",
    );
  });

  it("signs off with the sender and never repeats the client twice", () => {
    const update = build({
      companyName: "ASP Noard",
      deal: deal({ name: "ASP Noard: staging klaar" }),
      senderName: "John Plantenga",
    });

    expect(update.body).toContain("Met vriendelijke groet,\nJohn Plantenga");
    expect(update.body).toContain(
      "Een korte update over ASP Noard: staging klaar.",
    );
    expect(update.subject).toBe(
      "Statusupdate ASP Noard - ASP Noard: staging klaar",
    );
  });

  it("keeps the list short enough to read", () => {
    const update = build({
      steps: Array.from({ length: 12 }, (_, index) =>
        step(`taak ${index}`, { done_date: "2026-07-22T09:00:00.000Z" }),
      ),
    });

    const doneSection = update.sections.find(
      (section) => section.heading === "Wat er is gedaan",
    );
    expect(doneSection?.lines).toHaveLength(6);
  });
});
