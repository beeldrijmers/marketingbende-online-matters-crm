import { describe, expect, it } from "vitest";

import type { MonthlyHeadlineMetric } from "./monthlyReport.ts";
import {
  buildDefaultReportNarrative,
  buildNarrativePromptContext,
  buildReportEvidence,
  mergeInzyteNarrative,
  sanitizeReportEvidenceText,
} from "./reportEvidence.ts";

const period = {
  reportingMonth: "2026-06-01",
  currentStart: "2026-06-01",
  currentEnd: "2026-06-30",
  previousStart: "2026-05-01",
  previousEnd: "2026-05-31",
};

const metrics: MonthlyHeadlineMetric[] = [
  {
    key: "clicks",
    label: "Organische klikken",
    source: "Search Console",
    group: "seo",
    definition: "Klikken uit onbetaalde zoekresultaten.",
    format: "number",
    current: 120,
    previous: 100,
    change: 20,
    changePercent: 20,
    favourable: true,
  },
  {
    key: "ctr",
    label: "Klikratio",
    source: "Search Console",
    group: "seo",
    definition: "Aandeel vertoningen dat tot een klik leidt.",
    format: "percent",
    current: 2.4,
    previous: 3,
    change: -0.6,
    changePercent: -20,
    favourable: false,
  },
];

const evidence = () =>
  buildReportEvidence({
    assignmentDescription:
      "Doel: organische groei. Inloggegevens:\ninfo@voorbeeld.nl\nGeheim123!",
    currentWork: [
      {
        id: 1,
        task_text: "Paginatitels aangescherpt en gepubliceerd",
        completed_at: "2026-06-12T10:00:00Z",
      },
    ],
    allTimeWork: [
      {
        id: 1,
        task_text: "Paginatitels aangescherpt en gepubliceerd",
        completed_at: "2026-06-12T10:00:00Z",
      },
      {
        id: 2,
        task_text: "Zoekwoordenonderzoek afgerond",
        completed_at: "2026-05-10T10:00:00Z",
      },
    ],
    currentNotes: [
      {
        id: 8,
        text: "Redirectfout verholpen; komende maand monitoren.",
        date: "2026-06-20T10:00:00Z",
        activity_source: "trello",
      },
    ],
    allTimeNotes: [
      {
        id: 8,
        text: "Redirectfout verholpen; komende maand monitoren.",
        date: "2026-06-20T10:00:00Z",
        activity_source: "trello",
      },
      {
        id: 9,
        text: "Oud automatisch rapport",
        date: "2026-06-30T10:00:00Z",
        source_event_id: "seo-monthly-report:1",
      },
    ],
    sentMail: [
      {
        id: "mail-1",
        subject: "SEO-update juni",
        date: "2026-07-08T10:00:00Z",
        text: "De nieuwe landingspagina staat live. De klikratio vraagt nog aandacht.",
      },
    ],
    gmailStatus: "connected",
    period,
  });

describe("brononderbouwde SEO-maandrapportage", () => {
  it("verwijdert credentials en interne productnamen vóór redactieverwerking", () => {
    const safe = sanitizeReportEvidenceText(
      "Trello en Inzyte in CRM\nWachtwoord: Geheim123!\ninfo@voorbeeld.nl",
    );
    expect(safe).not.toMatch(/Trello|Inzyte|CRM|Geheim123|info@voorbeeld/);
  });

  it("neemt actuele en historische opdrachtbronnen mee zonder oude rapporten te herhalen", () => {
    const result = evidence();
    expect(result.counts.completedWork).toBe(2);
    expect(result.counts.cardComments).toBe(1);
    expect(result.counts.sentEmails).toBe(1);
    expect(result.current.some((item) => item.kind === "sent_email")).toBe(
      true,
    );
    expect(
      result.items.some((item) => item.excerpt.includes("automatisch rapport")),
    ).toBe(false);
  });

  it("schrijft positief waar mogelijk, met duiding, kanttekeningen en toekomstperspectief", () => {
    const narrative = buildDefaultReportNarrative({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics,
      evidence: evidence(),
    });
    expect(narrative.clientSummary).toContain("positieve ontwikkeling");
    expect(narrative.interpretation).toContain("niet als bewijs");
    expect(narrative.workSummary).toContain("Paginatitels");
    expect(narrative.caveats).toContain("Klikratio");
    expect(narrative.nextSteps).toContain("komende");
  });

  it("accepteert alleen bruikbare gestructureerde redactietekst en houdt een veilige fallback", () => {
    const fallback = buildDefaultReportNarrative({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics,
      evidence: evidence(),
    });
    expect(mergeInzyteNarrative("geen json", fallback)).toEqual(fallback);

    const merged = mergeInzyteNarrative(
      {
        answer: JSON.stringify({
          clientSummary:
            "De meetmaand laat een positieve ontwikkeling zien, met voldoende aanknopingspunten om verder op door te bouwen.",
          interpretation:
            "De groei ondersteunt de gekozen richting, terwijl we de kwaliteit van het verkeer blijven controleren.",
          workSummary:
            "• De belangrijkste paginatitels zijn gecontroleerd en aangescherpt.",
          caveats:
            "• De klikratio vraagt aandacht en kan mede door seizoen worden beïnvloed.",
          nextSteps:
            "• Volgende maand volgen we de zoekopdrachten en verbeteren we de relevante landingspagina's.",
        }),
      },
      fallback,
    );
    expect(merged.generatedBy).toBe("inzyte_ai");
    expect(merged.caveats).toContain("klikratio");
  });

  it("stuurt geen credentials of interne namen mee in de redactiecontext", () => {
    const context = buildNarrativePromptContext({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics,
      evidence: evidence(),
    });
    expect(context).not.toMatch(/Geheim123|info@voorbeeld|Trello|Inzyte|CRM/);
  });
});
