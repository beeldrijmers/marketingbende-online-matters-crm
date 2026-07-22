import { describe, expect, it } from "vitest";

import {
  buildClientUpdateText,
  buildInzytePresentation,
  buildInzytePrintDocument,
  humanizeInzyteField,
} from "./inzytePresentation";

const ga4Response = {
  dimensionHeaders: [{ name: "eventName" }],
  metricHeaders: [
    { name: "eventCount", type: "TYPE_INTEGER" },
    { name: "totalUsers", type: "TYPE_INTEGER" },
    { name: "eventsPerSession", type: "TYPE_FLOAT" },
  ],
  rows: [
    {
      dimensionValues: [{ value: "form_submit" }],
      metricValues: [{ value: "12" }, { value: "8" }, { value: "1.5" }],
    },
  ],
};

describe("Inzyte-presentatie", () => {
  it("zet een ruwe GA4-respons om naar één bruikbare Nederlandse tabel", () => {
    const presentation = buildInzytePresentation(ga4Response);

    expect(presentation.tables).toHaveLength(1);
    expect(presentation.tables[0]?.columns).toEqual([
      "eventName",
      "eventCount",
      "totalUsers",
      "eventsPerSession",
    ]);
    expect(presentation.tables[0]?.rows[0]).toEqual({
      eventName: "form_submit",
      eventCount: "12",
      totalUsers: "8",
      eventsPerSession: "1.5",
    });
    expect(humanizeInzyteField("eventsPerSession")).toBe(
      "Gebeurtenissen per sessie",
    );
  });

  it("vertaalt sectienamen uit het Inzyte-overzicht", () => {
    const presentation = buildInzytePresentation({
      dayData: [{ dayName: "Maandag", activeUsers: 4, sessions: 5 }],
      topPagesBreakdown: [{ page: "/contact", views: 9 }],
    });

    expect(presentation.tables.map((table) => table.title)).toEqual([
      "Resultaten per dag",
      "Best bezochte pagina’s",
    ]);
  });

  it("maakt een klantupdate zonder technische GA4-velden", () => {
    const text = buildClientUpdateText({
      data: ga4Response,
      title: "Voorbeeldklant",
      actionLabel: "Conversies",
      completedAt: "2026-07-22T16:00:00.000Z",
      startDate: "2026-06-22",
      endDate: "2026-07-21",
    });

    expect(text).toContain("Conversies — Voorbeeldklant");
    expect(text).toContain("Gebeurtenis: form_submit");
    expect(text).not.toContain("dimensionHeaders");
    expect(text).not.toContain("TYPE_INTEGER");
  });

  it("bouwt een verzorgd Nederlandstalig afdrukdocument", () => {
    const html = buildInzytePrintDocument({
      data: ga4Response,
      title: "Voorbeeldklant",
      actionLabel: "Conversies",
      completedAt: "2026-07-22T16:00:00.000Z",
      startDate: "2026-06-22",
      endDate: "2026-07-21",
    });

    expect(html).toContain("Marketingbende · klantupdate");
    expect(html).toContain("Gebeurtenissen per sessie");
    expect(html).not.toContain("dimensionHeaders");
    expect(html).not.toContain("TYPE_INTEGER");
  });
});
