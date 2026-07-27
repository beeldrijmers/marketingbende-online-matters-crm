import { describe, expect, it } from "vitest";

import type { MonthlyHeadlineMetric } from "./monthlyReport.ts";
import {
  buildDefaultReportNarrative,
  buildNarrativePromptContext,
  buildReportEvidence,
  isNarrativeSupportedByMetrics,
  mergeInzyteNarrative,
  sanitizeReportEvidenceText,
  unwrapHardBreaks,
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
      {
        id: 10,
        text: "Komende maand verwijderen we de oude catalogus.",
        date: "2026-05-15T10:00:00Z",
        activity_source: "trello",
      },
    ],
    sentMail: [
      {
        id: "mail-1",
        subject: "SEO-update juni",
        date: "2026-07-08T10:00:00Z",
        text: "De nieuwe landingspagina staat live. De klikratio vraagt nog aandacht.",
      },
      {
        id: "mail-2",
        subject: "Nieuwe oplevering",
        date: "2026-07-10T10:00:00Z",
        text: "De nieuwe configurator is live gezet.",
      },
    ],
    gmailStatus: "connected",
    period,
  });

describe("brononderbouwde SEO-maandrapportage", () => {
  it("verwijdert credentials en interne productnamen vóór redactieverwerking", () => {
    const safe = sanitizeReportEvidenceText(
      "Trello en Inzyte in CRM\nInloggegevens:\nbeheerder\nGeheim123!\ninfo@voorbeeld.nl",
    );
    expect(safe).not.toMatch(
      /Trello|Inzyte|CRM|beheerder|Geheim123|info@voorbeeld/,
    );
  });

  it("behoudt gewone voortgangszinnen over beveiliging en koppelingen", () => {
    const safe = sanitizeReportEvidenceText(
      "Authenticatie is ingericht.\nDe API-koppeling is gecontroleerd.",
    );

    expect(safe).toContain("Authenticatie is ingericht");
    expect(safe).toContain("API-koppeling is gecontroleerd");
  });

  it("neemt actuele en historische opdrachtbronnen mee zonder oude rapporten te herhalen", () => {
    const result = evidence();
    expect(result.counts.completedWork).toBe(2);
    expect(result.counts.cardComments).toBe(2);
    expect(result.counts.sentEmails).toBe(2);
    expect(result.currentCounts.completedWork).toBe(1);
    expect(result.currentCounts.cardComments).toBe(1);
    expect(result.currentCounts.sentEmails).toBe(1);
    expect(result.allTimeCounts.sentEmails).toBe(2);
    expect(result.current.some((item) => item.kind === "sent_email")).toBe(
      true,
    );
    expect(result.current.some((item) => item.id === "mail:mail-2")).toBe(
      false,
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
    expect(narrative.nextSteps).not.toContain("oude catalogus");
  });

  it("rapporteert werkzaamheden eerlijk wanneer meetgegevens ontbreken", () => {
    const narrative = buildDefaultReportNarrative({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics: [],
      evidence: evidence(),
    });

    expect(narrative.clientSummary).toContain(
      "geen volledige gecontroleerde meetreeks",
    );
    expect(narrative.clientSummary).toContain("uitgevoerd werk");
    expect(narrative.interpretation).toContain(
      "geen betrouwbare conclusie over verkeer",
    );
    expect(narrative.workSummary).toContain("Paginatitels");
    expect(narrative.caveats).toContain(
      "geen volledige gecontroleerde maand-op-maandmeting",
    );
    expect(narrative.nextSteps).toContain(
      "Werkzaamheden en klantbesluiten consequent",
    );
    expect(narrative.interpretation).not.toMatch(
      /stabiele basis|beter presteerde|duidelijke groei/i,
    );
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
            "De groei ondersteunt de gekozen richting, terwijl we de kwaliteit van de zoekresultaten blijven controleren.",
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
    expect(isNarrativeSupportedByMetrics(merged, metrics)).toBe(true);
  });

  it("weigert AI-tekst met meetclaims die niet in de gecontroleerde cijfers zitten", () => {
    const fallback = buildDefaultReportNarrative({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics,
      evidence: evidence(),
    });
    const unsupported = {
      ...fallback,
      clientSummary:
        "De conversies zijn met 87% gestegen en laten een overtuigende ontwikkeling zien.",
      generatedBy: "inzyte_ai" as const,
    };

    expect(isNarrativeSupportedByMetrics(unsupported, metrics)).toBe(false);
  });

  it("weigert een verkeerd absoluut meetgetal bij een bestaande bron", () => {
    const fallback = buildDefaultReportNarrative({
      companyName: "Voorbeeldbedrijf",
      period,
      metrics,
      evidence: evidence(),
    });
    const unsupported = {
      ...fallback,
      clientSummary:
        "De organische klikken zijn gestegen naar 999 en laten daarmee een positieve ontwikkeling zien.",
      generatedBy: "inzyte_ai" as const,
    };

    expect(isNarrativeSupportedByMetrics(unsupported, metrics)).toBe(false);
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

describe("halve zinnen uit hard afgebroken mail", () => {
  // De maandrapportage draait sinds vandaag vanzelf, dus deze tekst ontstaat
  // zes keer per maand zonder dat iemand ernaar kijkt. Wat er stond:
  //   "de website rond hellende daken en pannendaken verder op te bouwen."
  const gewrapteMail = [
    "In juni hebben we de strategie voortgezet om de thematische autoriteit van",
    "de website rond hellende daken en pannendaken verder op te bouwen. Waar de",
    "voorgaande maanden sterk op locatiepagina's gericht waren, hebben we deze",
    "ronde bewust gekozen voor diepgang.",
  ].join("\n");

  it("plakt doorlopende regels weer aan elkaar", () => {
    expect(unwrapHardBreaks(gewrapteMail)).toBe(
      "In juni hebben we de strategie voortgezet om de thematische autoriteit van " +
        "de website rond hellende daken en pannendaken verder op te bouwen. Waar de " +
        "voorgaande maanden sterk op locatiepagina's gericht waren, hebben we deze " +
        "ronde bewust gekozen voor diepgang.",
    );
  });

  it("laat een opsomming een opsomming", () => {
    const lijst = [
      "Opgeleverd deze maand:",
      "- vijftien pagina's",
      "- metadata",
    ].join("\n");
    expect(unwrapHardBreaks(lijst)).toBe(lijst);
  });

  it("laat een nieuwe zin met hoofdletter op zijn eigen regel staan", () => {
    const twee = "Vijftien pagina's opgeleverd\nDe metadata is bijgewerkt";
    expect(unwrapHardBreaks(twee)).toBe(twee);
  });
});

describe("bullets uit een hard afgebroken mail", () => {
  const narratief = () =>
    buildDefaultReportNarrative({
      companyName: "MB Roofing",
      period,
      metrics: [],
      evidence: buildReportEvidence({
        assignmentDescription: "",
        currentWork: [],
        allTimeWork: [],
        currentNotes: [],
        allTimeNotes: [],
        sentMail: [
          {
            id: "mail-1",
            subject: "SEO-statusupdate juni",
            date: "2026-06-28T10:00:00Z",
            text: [
              "**Wat is opgeleverd**",
              "We hebben 15 nieuwe, geoptimaliseerde landingspagina's gepubliceerd: 12",
              "over pannendaken en 3 over daklekkages.",
              "In juni hebben we de strategie voortgezet om de thematische autoriteit",
              "van de website rond hellende daken verder op te bouwen.",
            ].join("\n"),
          },
        ],
        gmailStatus: "ok",
        period,
      }),
    });

  it("levert hele zinnen, geen brokstukken", () => {
    const regels = narratief()
      .workSummary.split("\n")
      .map((regel) => regel.replace(/^•\s*/, ""));

    expect(regels).toContain(
      "We hebben 15 nieuwe, geoptimaliseerde landingspagina's gepubliceerd: 12 over pannendaken en 3 over daklekkages.",
    );
    // Precies de regels die in productie in de juni-rapportage stonden.
    expect(regels).not.toContain("Wat is opgeleverd*.");
    expect(regels).not.toContain(
      "We hebben 15 nieuwe, geoptimaliseerde landingspagina's gepubliceerd: 12.",
    );
  });

  it("laat geen enkele regel met een kleine letter beginnen", () => {
    const alles = [
      narratief().workSummary,
      narratief().nextSteps,
      narratief().caveats,
    ].join("\n");
    for (const regel of alles.split("\n").filter(Boolean)) {
      expect(regel.replace(/^•\s*/, "")).toMatch(/^[^a-z]/);
    }
  });
});
