import { describe, expect, it } from "vitest";
import { buildRemoteRequest, normalizeDateRange } from "./actions.ts";

const link = {
  ga4_connection_id: "connection-id",
  ga4_property_id: "123456789",
  ga4_property_name: "Klantwebsite",
  website_url: "https://voorbeeld.nl",
  gsc_site_url: "sc-domain:voorbeeld.nl",
  gbp_location_id: "locations/123",
  ads_customer_id: "1234567890",
};

describe("normalizeDateRange", () => {
  it("keeps a valid selected period", () => {
    expect(normalizeDateRange("2026-06-01", "2026-06-30")).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });

  it("falls back to the previous 30 complete days", () => {
    expect(
      normalizeDateRange(
        "wrong",
        "also-wrong",
        new Date("2026-07-22T12:00:00Z"),
      ),
    ).toEqual({ startDate: "2026-06-22", endDate: "2026-07-21" });
  });
});

describe("buildRemoteRequest", () => {
  it("never lets a payload override the mapped GA4 property", () => {
    const request = buildRemoteRequest("overview", link, {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
      payload: { propertyId: "999", connectionId: "attacker" },
    });
    expect(request.path).toBe("ga4/analytics-data");
    expect(request.body).toMatchObject({
      propertyId: "123456789",
      connectionId: "connection-id",
    });
  });

  it("addresses Search Console with the per-assignment site", () => {
    expect(
      buildRemoteRequest("search_console", link, {
        startDate: "2026-07-01",
        endDate: "2026-07-21",
      }),
    ).toMatchObject({
      path: "search-console",
      requiresGa4: false,
      body: { siteUrl: "sc-domain:voorbeeld.nl" },
    });
  });

  it("caps Vraagbaak input at Inzyte's accepted length", () => {
    const request = buildRemoteRequest("vraagbaak", link, {
      question: "x".repeat(2_500),
    });
    expect(String(request.body?.question)).toHaveLength(2_000);
    expect(request.body).toMatchObject({ language: "nl" });
  });

  it("opens every structured Inzyte analysis with Dutch customer data", () => {
    const request = buildRemoteRequest("comprehensive_analysis", link, {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
      payload: {
        kpiData: { visitors: 42 },
        businessContext: "Lokale zakelijke dienstverlener",
      },
    });
    expect(request).toMatchObject({
      path: "analytics-insights-structured/comprehensive",
      requiresGa4: true,
      body: {
        kpiData: { visitors: 42 },
        businessContext: "Lokale zakelijke dienstverlener",
        language: "nl",
      },
    });
  });

  it("limits section analysis to supported Inzyte modules", () => {
    const request = buildRemoteRequest("section_analysis", link, {
      payload: {
        sectionType: "../../admin",
        data: { totalUsers: 17 },
      },
    });
    expect(request).toMatchObject({
      path: "analytics-insights/section-analysis",
      body: {
        sectionType: "traffic_comprehensive",
        data: { totalUsers: 17 },
      },
    });
  });
});
