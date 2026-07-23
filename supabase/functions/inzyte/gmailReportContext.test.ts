import { describe, expect, it } from "vitest";

import type { MonthlyReportPeriod } from "./monthlyReport.ts";
import { buildSentMailSearchQuery } from "./gmailReportQuery.ts";

const period: MonthlyReportPeriod = {
  reportingMonth: "2026-06-01",
  currentStart: "2026-06-01",
  currentEnd: "2026-06-30",
  previousStart: "2026-05-01",
  previousEnd: "2026-05-31",
};

describe("verzonden e-mail als rapportbron", () => {
  it("zoekt vanaf de opdrachtstart tot na het einde van de meetmaand", () => {
    const query = buildSentMailSearchQuery({
      companyName: "Online Voorbeeld",
      dealName: "[SEO MAAND] Online Voorbeeld — juni",
      website: "https://www.voorbeeld.nl/pagina",
      createdAt: "2026-01-15T10:00:00Z",
      period,
      now: new Date("2026-07-23T12:00:00Z"),
    });

    expect(query).toContain("in:sent");
    expect(query).toContain("after:2026/01/15");
    expect(query).toContain("before:2026/07/22");
    expect(query).toContain('"Online Voorbeeld"');
    expect(query).toContain('"voorbeeld.nl"');
  });

  it("geeft geen brede mailboxzoekopdracht zonder klantkenmerk", () => {
    expect(
      buildSentMailSearchQuery({
        companyName: "",
        dealName: "[SEO]",
        website: "",
        createdAt: "",
        period,
      }),
    ).toBeNull();
  });
});
