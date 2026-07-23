import { describe, expect, it } from "vitest";

import type { SeoMonthlyReport } from "../../types";
import {
  buildSeoMonthlyReportDocument,
  buildSeoMonthlyReportText,
  customerFacingText,
  getCustomerReportReadiness,
} from "./seoMonthlyReportDocument";

const report = (complete = true): SeoMonthlyReport => ({
  id: 42,
  deal_id: 9,
  company_id: 3,
  reporting_month: "2026-06-01",
  status: "draft",
  title: "SEO-maandupdate juni 2026",
  current_start: "2026-06-01",
  current_end: "2026-06-30",
  previous_start: "2026-05-01",
  previous_end: "2026-05-31",
  data_through: "2026-06-30",
  client_summary: "De organische vindbaarheid is deze maand verder gegroeid.",
  work_summary:
    "Technische paginatitels aangescherpt en interne links verbeterd.",
  next_steps:
    "Komende maand breiden we de belangrijkste landingspagina verder uit.",
  headline_metrics: [
    {
      key: "clicks",
      label: "Organische klikken",
      source: "Search Console",
      group: "seo",
      definition: "Klikken vanuit onbetaalde Google-resultaten.",
      format: "number",
      current: 120,
      previous: 100,
      change: 20,
      changePercent: 20,
      favourable: true,
    },
  ],
  current_work_count: 2,
  all_time_work_count: 8,
  generated_at: "2026-07-22T10:00:00Z",
  finalized_at: null,
  updated_at: "2026-07-22T10:00:00Z",
  report_data: {
    version: 2,
    generatedAt: "2026-07-22T10:00:00Z",
    presentation: { brand: "online_matters" },
    period: {
      reportingMonth: "2026-06-01",
      currentStart: "2026-06-01",
      currentEnd: "2026-06-30",
      previousStart: "2026-05-01",
      previousEnd: "2026-05-31",
    },
    assignment: {
      id: 9,
      name: "SEO juni",
      description: null,
      category: "SEO",
      createdAt: "2026-06-01T00:00:00Z",
      recurring: true,
    },
    sources: {
      ga4: {
        current: { status: complete ? "success" : "failed" },
        previous: { status: "success" },
      },
      searchConsole: {
        current: { status: "unavailable" },
        previous: { status: "unavailable" },
      },
    },
    work: {
      current: [],
      allTime: [],
      allTimeCount: 8,
      allTimeNoteCount: 4,
      currentInternalActivity: [],
      allTimeInternalActivity: [],
    },
  },
});

describe("SEO-klantrapport", () => {
  it("gebruikt de Online Matters-huisstijl zonder interne systeemnamen", () => {
    const html = buildSeoMonthlyReportDocument({
      report: report(),
      companyName: "Voorbeeldbedrijf",
      clientSummary:
        "De analyse uit CRM + Inzyte laat een duidelijke groei zien.",
      interpretation:
        "De groei betekent dat meer relevante bezoekers de website via Google weten te vinden.",
      workSummary:
        "De taken uit het CRM/Trello-werkzaamhedenlogboek zijn uitgevoerd.",
      caveats:
        "De ontwikkeling blijft mede afhankelijk van seizoen en concurrentie.",
      nextSteps: "Volgende maand verbeteren we de belangrijkste pagina's.",
      brand: "online_matters",
    });

    expect(html).toContain("Online Matters");
    expect(html).toContain("Wat deze ontwikkeling betekent");
    expect(html).toContain("Wat we deze maand hebben uitgevoerd");
    expect(html).toContain("Eerlijke aandachtspunten");
    expect(html).toContain("Vooruitblik");
    expect(html).not.toMatch(/CRM|Inzyte|Trello|Marketingbende/);
    expect(html).not.toContain("crm.marketingbende.nl");
  });

  it("blokkeert delen als een volledige vergelijking of werkzaamheden ontbreken", () => {
    const readiness = getCustomerReportReadiness({
      report: report(false),
      clientSummary: "Dit is een voldoende lange samenvatting voor de klant.",
      interpretation:
        "Dit is een praktische duiding van de beschikbare ontwikkeling.",
      workSummary: "Er zijn geen afgeronde werkzaamheden geregistreerd.",
      caveats:
        "De gegevens zijn nog onvolledig en vragen daarom om voorzichtigheid.",
      nextSteps: "Komende maand verbeteren we de belangrijkste landingspagina.",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("een volledige maand-op-maandmeting");
    expect(readiness.reasons).toContain(
      "concrete werkzaamheden uit de meetmaand",
    );
  });

  it("maakt ook de gekopieerde klantupdate vrij van interne termen", () => {
    const text = buildSeoMonthlyReportText({
      report: report(),
      clientSummary: "In het CRM-logboek zien we voldoende meetbare groei.",
      interpretation:
        "De resultaten uit Inzyte geven een bruikbaar beeld van de ontwikkeling.",
      workSummary:
        "De taken uit Trello zijn deze maand volgens planning afgerond.",
      caveats:
        "De CRM-historie bevat nog enkele meetpunten die we blijven volgen.",
      nextSteps: "De analyse in Inzyte gebruiken we voor de volgende stap.",
    });

    expect(text).not.toMatch(/CRM|Inzyte|Trello/);
    expect(text).toContain("Wat deze ontwikkeling betekent");
    expect(text).toContain("Eerlijke aandachtspunten");
    expect(text).toContain("Vooruitblik");
    expect(customerFacingText("CRM + Inzyte")).toBe("Online Matters");
  });
});
