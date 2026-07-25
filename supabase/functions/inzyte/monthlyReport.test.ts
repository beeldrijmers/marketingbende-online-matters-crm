import { describe, expect, it } from "vitest";

import {
  buildMonthlyHeadlineMetrics,
  defaultReportingMonth,
  hasSuccessfulMonthlyComparison,
  monthlyReportPeriod,
} from "./monthlyReport.ts";

describe("monthlyReportPeriod", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("uses the last complete calendar month by default", () => {
    expect(defaultReportingMonth(now)).toBe("2026-06");
    expect(monthlyReportPeriod(undefined, now)).toEqual({
      reportingMonth: "2026-06-01",
      currentStart: "2026-06-01",
      currentEnd: "2026-06-30",
      previousStart: "2026-05-01",
      previousEnd: "2026-05-31",
    });
  });

  it("accepts a historic month and rejects an incomplete future month", () => {
    expect(monthlyReportPeriod("2026-02", now).currentEnd).toBe("2026-02-28");
    expect(monthlyReportPeriod("2026-07", now).reportingMonth).toBe(
      "2026-06-01",
    );
  });
});

describe("buildMonthlyHeadlineMetrics", () => {
  it("compares Dutch-facing GA4 and Search Console KPIs", () => {
    const metrics = buildMonthlyHeadlineMetrics({
      ga4Current: { data: { totals: { sessions: 150, activeUsers: 90 } } },
      ga4Previous: { data: { totals: { sessions: 100, activeUsers: 80 } } },
      gscCurrent: {
        data: {
          summary: { clicks: 60, impressions: 1200, ctr: 0.05, position: 8 },
        },
      },
      gscPrevious: {
        data: {
          summary: { clicks: 40, impressions: 1000, ctr: 0.04, position: 10 },
        },
      },
    });

    expect(metrics.find((metric) => metric.key === "sessions")).toMatchObject({
      current: 150,
      previous: 100,
      changePercent: 50,
      favourable: true,
      group: "website_context",
    });
    expect(metrics.find((metric) => metric.key === "ctr")).toMatchObject({
      current: 5,
      previous: 4,
    });
    expect(metrics.find((metric) => metric.key === "position")).toMatchObject({
      change: -2,
      favourable: true,
      group: "seo",
    });
  });

  it("sums additive daily values but does not sum unique users", () => {
    const metrics = buildMonthlyHeadlineMetrics({
      ga4Current: {
        dayData: [
          { sessions: 4, activeUsers: 3 },
          { sessions: 6, activeUsers: 4 },
        ],
      },
      ga4Previous: {
        dayData: [
          { sessions: 2, activeUsers: 2 },
          { sessions: 3, activeUsers: 3 },
        ],
      },
    });
    expect(metrics.find((metric) => metric.key === "sessions")).toMatchObject({
      current: 10,
      previous: 5,
    });
    expect(
      metrics.find((metric) => metric.key === "activeUsers"),
    ).toBeUndefined();
  });

  it("neemt gecontroleerde Ads- en Bedrijfsprofielcijfers mee", () => {
    const metrics = buildMonthlyHeadlineMetrics({
      adsCurrent: {
        summary: { clicks: 80, impressions: 2400, conversions: 12 },
      },
      adsPrevious: {
        summary: { clicks: 60, impressions: 2000, conversions: 8 },
      },
      gbpCurrent: { totals: { profileViews: 900, profileActions: 45 } },
      gbpPrevious: { totals: { profileViews: 750, profileActions: 30 } },
    });

    expect(metrics.find((metric) => metric.key === "adsClicks")).toMatchObject({
      source: "Google Ads",
      group: "ads",
      current: 80,
      previous: 60,
    });
    expect(
      metrics.find((metric) => metric.key === "businessProfileViews"),
    ).toMatchObject({
      source: "Google Bedrijfsprofiel",
      group: "local",
      current: 900,
      previous: 750,
    });
  });

  it("vermijdt misleidende aliassen en dubbele Bedrijfsprofieltotalen", () => {
    const metrics = buildMonthlyHeadlineMetrics({
      ga4Current: { totals: { totalUsers: 90 } },
      ga4Previous: { totals: { totalUsers: 80 } },
      gbpCurrent: {
        totals: {
          profileActions: 45,
          websiteClicks: 20,
          callClicks: 10,
        },
      },
      gbpPrevious: {
        totals: {
          profileActions: 30,
          websiteClicks: 12,
          callClicks: 8,
        },
      },
    });

    expect(
      metrics.find((metric) => metric.key === "activeUsers"),
    ).toBeUndefined();
    expect(
      metrics.find((metric) => metric.key === "businessProfileActions"),
    ).toBeUndefined();
    expect(
      metrics.find((metric) => metric.key === "businessProfileWebsiteClicks"),
    ).toBeDefined();
    expect(
      metrics.find((metric) => metric.key === "businessProfileCalls"),
    ).toBeDefined();
  });
});

describe("hasSuccessfulMonthlyComparison", () => {
  it("requires both months from the same source", () => {
    expect(
      hasSuccessfulMonthlyComparison([
        {
          current: { status: "success" },
          previous: { status: "failed" },
        },
        {
          current: { status: "unavailable" },
          previous: { status: "success" },
        },
      ]),
    ).toBe(false);
  });

  it("accepts one complete month-on-month source pair", () => {
    expect(
      hasSuccessfulMonthlyComparison([
        {
          current: { status: "success" },
          previous: { status: "success" },
        },
      ]),
    ).toBe(true);
  });
});
