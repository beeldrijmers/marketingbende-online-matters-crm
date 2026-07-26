import type {
  Deal,
  SeoMonthlyHeadlineMetric,
  SeoMonthlyReportSummary,
  Task,
} from "../types";
import {
  buildCompanyStatusUpdate,
  buildStatusUpdate,
  selectStatusUpdateResults,
} from "./statusUpdateModel";

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

describe("buildStatusUpdate, short variant", () => {
  it("fits a chat message: no greeting, no sign-off, one line per block", () => {
    const update = build({
      deal: deal({ stage: "bezig", delivery_date: "2026-08-14" }),
      senderName: "John Plantenga",
      steps: [
        step("staging ingericht", { done_date: "2026-07-22T09:00:00.000Z" }),
        step("content nakijken"),
      ],
      variant: "short",
    });

    expect(update.body).not.toContain("Beste,");
    expect(update.body).not.toContain("Met vriendelijke groet");
    expect(update.body.split("\n")).toHaveLength(5);
    expect(update.body).toContain(
      "Update ASP Noard - Staging klaar, wacht op content",
    );
    expect(update.body).toContain("Waar we staan: We zijn aan het werk.");
    expect(update.body).toContain("Wat er nu gebeurt: Content nakijken.");
  });

  it("reports the same facts as the full version", () => {
    const input = {
      deal: deal({ stage: "on-hold" }),
      steps: [
        step("staging ingericht", { done_date: "2026-07-22T09:00:00.000Z" }),
      ],
    };
    const short = build({ ...input, variant: "short" });
    const full = build({ ...input, variant: "full" });

    expect(short.sections).toEqual(full.sections);
    expect(short.subject).toBe(full.subject);
  });
});

describe("buildCompanyStatusUpdate", () => {
  it("bundles every open assignment under one greeting", () => {
    const update = buildCompanyStatusUpdate({
      companyName: "Hunting XL",
      deals: [
        {
          deal: deal({
            category: "seo",
            name: "Maandelijkse optimalisatie",
            stage: "maandelijks",
          }),
          steps: [
            step("teksten bijgewerkt", {
              done_date: "2026-07-22T09:00:00.000Z",
            }),
          ],
        },
        {
          deal: deal({
            category: "eenmalig",
            name: "Jack Pyke-import",
            stage: "informatie-pipeline",
          }),
          steps: [step("prijzen controleren")],
        },
      ],
      now,
      senderName: "John Plantenga",
    });

    expect(update.subject).toBe(
      "Statusupdate Hunting XL - 2 lopende opdrachten",
    );
    expect(update.body.match(/Beste,/g)).toHaveLength(1);
    expect(update.body.match(/Met vriendelijke groet/g)).toHaveLength(1);
    // The blocks are named after the work as a client knows it, not after our
    // card titles.
    expect(update.body).toContain("Het SEO-werk:");
    expect(update.body).toContain("Uw aanvraag:");
    expect(update.body).toContain("- Het maandelijkse werk loopt.");
    // A lead's open steps are our intake checklist, so they stay internal.
    expect(update.body).not.toContain("Prijzen controleren");
    expect(update.completedSinceLastUpdate).toBe(1);
  });

  it("reads like a single-assignment update when there is only one", () => {
    const one = {
      deal: deal({
        category: "website-development",
        name: "Staging klaar",
        stage: "controle-livegang",
      }),
      steps: [],
    };
    const bundled = buildCompanyStatusUpdate({
      companyName: "ASP Noard",
      deals: [one],
      now,
    });

    expect(bundled.subject).toBe("Statusupdate ASP Noard - Uw website");
    expect(bundled.body).toContain("Een korte update over uw website.");
  });

  it("stays short when the short variant is asked for", () => {
    const update = buildCompanyStatusUpdate({
      companyName: "Hunting XL",
      deals: [
        { deal: deal({ name: "Webshop", stage: "bezig" }), steps: [] },
        { deal: deal({ name: "SEO", stage: "maandelijks" }), steps: [] },
      ],
      now,
      variant: "short",
    });

    expect(update.body.split("\n")).toHaveLength(3);
    expect(update.body.startsWith("Update Hunting XL")).toBe(true);
  });
});

const metric = (
  overrides: Partial<SeoMonthlyHeadlineMetric> = {},
): SeoMonthlyHeadlineMetric => ({
  change: 120,
  changePercent: 18.4,
  current: 1240,
  definition: "Klikken uit Google",
  favourable: true,
  format: "number",
  group: "seo",
  key: "clicks",
  label: "Klikken uit Google",
  previous: 1048,
  source: "Search Console",
  ...overrides,
});

const report = (
  overrides: Partial<SeoMonthlyReportSummary> = {},
): SeoMonthlyReportSummary => ({
  all_time_work_count: 40,
  current_work_count: 6,
  deal_id: 1,
  finalized_at: null,
  generated_at: "2026-07-01T09:00:00.000Z",
  headline_metrics: [metric()],
  id: 1,
  reporting_month: "2026-07-01",
  status: "final",
  title: "SEO juli",
  ...overrides,
});

describe("selectStatusUpdateResults", () => {
  it("uses this month's report", () => {
    const results = selectStatusUpdateResults(report(), now);

    expect(results?.monthLabel).toBe("juli");
    expect(results?.metrics).toHaveLength(1);
  });

  it("still uses last month's report, because that is what gets reported", () => {
    const results = selectStatusUpdateResults(
      report({ reporting_month: "2026-06-01" }),
      now,
    );

    expect(results?.monthLabel).toBe("juni");
  });

  it("refuses a stale report rather than putting old numbers in a new update", () => {
    expect(
      selectStatusUpdateResults(report({ reporting_month: "2026-03-01" }), now),
    ).toBeUndefined();
    expect(
      selectStatusUpdateResults(report({ reporting_month: "2026-09-01" }), now),
    ).toBeUndefined();
  });

  it("keeps internal metrics out and returns nothing when only those remain", () => {
    const results = selectStatusUpdateResults(
      report({
        headline_metrics: [
          metric({ group: "seo", key: "clicks" }),
          metric({ group: "ads", key: "adsClicks" }),
          metric({ group: "local", key: "calls" }),
        ],
      }),
      now,
    );
    expect(results?.metrics.map((m) => m.key)).toEqual(["clicks"]);

    expect(
      selectStatusUpdateResults(
        report({ headline_metrics: [metric({ group: "ads" })] }),
        now,
      ),
    ).toBeUndefined();
  });

  it("does nothing without a connection or a report", () => {
    expect(selectStatusUpdateResults(null, now)).toBeUndefined();
    expect(
      selectStatusUpdateResults(report({ headline_metrics: [] }), now),
    ).toBeUndefined();
  });
});

describe("buildStatusUpdate with measured results", () => {
  it("puts the figures in the client's update as sentences", () => {
    const update = build({
      deal: deal({ stage: "maandelijks", revenue_period: "maandelijks" }),
      results: {
        monthLabel: "juni",
        metrics: [
          metric(),
          metric({
            changePercent: null,
            key: "position",
            label: "Gemiddelde positie",
            format: "decimal",
            current: 12.4,
          }),
        ],
      },
    });

    expect(update.body).toContain("Resultaten in juni:");
    expect(update.body).toContain(
      "- Klikken uit Google: 1.240 (+18,4% tegenover de vorige periode).",
    );
    expect(update.body).toContain(
      "- Gemiddelde positie: 12,4 (eerste meting).",
    );
  });

  it("has no results block at all without a connection", () => {
    const update = build({ deal: deal({ stage: "bezig" }) });

    expect(update.body).not.toContain("Resultaten");
  });
});

describe("buildStatusUpdate and what happens next", () => {
  it("tells a client with finished work that the invoice follows", () => {
    const update = build({ deal: deal({ stage: "facturatie-live" }) });

    expect(update.body).toContain("Hoe verder:");
    expect(update.body).toContain(
      "De factuur volgt; daarna sluiten we de opdracht af.",
    );
    // A delivery date is history once the work is done.
    expect(update.body).not.toContain("Oplevering staat gepland");
  });

  it("does not leave a closing update as a dead end", () => {
    const update = build({ deal: deal({ stage: "won" }) });

    expect(update.body).toContain("Daarmee is deze opdracht afgerond.");
  });

  it("promises the next monthly update for recurring work", () => {
    const update = build({
      deal: deal({ stage: "maandelijks", revenue_period: "maandelijks" }),
    });

    expect(update.body).toContain(
      "Begin augustus sturen we de volgende maandupdate.",
    );
  });

  it("names the month a monthly report covers", () => {
    const update = build({
      deal: deal({
        stage: "maandelijks",
        revenue_period: "maandelijks",
        client_updated_at: "2026-07-01T09:00:00.000Z",
      }),
      steps: [
        step("teksten bijgewerkt", { done_date: "2026-07-20T09:00:00.000Z" }),
      ],
    });

    expect(update.body).toContain("Wat we in juli hebben gedaan:");
  });

  it("still promises a next step for work that is simply running", () => {
    const update = build({ deal: deal({ stage: "bezig" }) });

    expect(update.body).toContain("Bij de volgende stap hoort u weer van ons.");
  });
});

describe("buildStatusUpdate keeps internal work internal", () => {
  const team = ["John Plantenga", "Rick Maarssen"];

  it("does not send our intake checklist to the client", () => {
    const update = build({
      deal: deal({
        category: "overig",
        name: "Rick belt voor intake en B2B-fit",
        stage: "informatie-pipeline",
      }),
      steps: [
        step(
          "Rick belt de heer Mohammed Nadi via +31 6 50610409 voor introductie",
        ),
        step(
          "Doelaccounts en beslissers bepalen, waaronder Elkien en WoonFriesland",
        ),
        step("Rick beoordeelt of het bij hem/Online Matters past"),
      ],
      teamNames: team,
    });

    expect(update.body).not.toMatch(/Rick/);
    expect(update.body).not.toMatch(/50610409/);
    expect(update.body).not.toMatch(/Doelaccounts|beslissers|Online Matters/);
    // And it still says something useful.
    expect(update.body).toContain(
      "We hebben het voorstel klaarliggen en wachten op uw akkoord.",
    );
    expect(update.subject).toBe("Statusupdate ASP Noard - Uw aanvraag");
  });

  it("filters an internal line out of running work but keeps the rest", () => {
    const update = build({
      deal: deal({ category: "website-development", stage: "bezig" }),
      steps: [
        step("Overleg met Rick over de planning"),
        step("Staging ingericht en gevuld", {
          done_date: "2026-07-22T09:00:00.000Z",
        }),
        step("**Teksten** geplaatst", {
          done_date: "2026-07-23T09:00:00.000Z",
        }),
        step("Formulieren testen"),
      ],
      teamNames: team,
    });

    expect(update.body).toContain("- Teksten geplaatst.");
    expect(update.body).toContain("- Staging ingericht en gevuld.");
    expect(update.body).toContain("- Formulieren testen.");
    expect(update.body).not.toContain("Rick");
    // Markdown never reaches a client-facing text.
    expect(update.body).not.toContain("**");
  });

  it("keeps the short variant genuinely short", () => {
    const update = build({
      deal: deal({ category: "seo", stage: "maandelijks" }),
      steps: Array.from({ length: 6 }, (_, index) =>
        step(`taak ${index} afgerond`, {
          done_date: "2026-07-22T09:00:00.000Z",
        }),
      ),
      variant: "short",
    });

    const workLine = update.body
      .split("\n")
      .find((line) => line.startsWith("Wat er is gedaan"));
    // Two items at most, so it stays a message and not a report.
    expect(workLine).toBe(
      "Wat er is gedaan: Taak 0 afgerond. Taak 1 afgerond.",
    );
    expect(update.body.split("\n").length).toBeLessThanOrEqual(5);
  });
});
