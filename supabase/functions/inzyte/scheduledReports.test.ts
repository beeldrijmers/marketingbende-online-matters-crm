import { describe, expect, it, vi } from "vitest";

import {
  hasConfiguredSource,
  pendingReportDeals,
  runScheduledReports,
  type SchedulableLink,
} from "./scheduledReports";

const link = (overrides: Partial<SchedulableLink>): SchedulableLink => ({
  deal_id: 1,
  ...overrides,
});

describe("hasConfiguredSource", () => {
  it("telt GA4 alleen mee als zowel het account als de property is gekozen", () => {
    expect(
      hasConfiguredSource(
        link({ ga4_connection_id: "abc", ga4_property_id: "123" }),
      ),
    ).toBe(true);
    // Een property zonder account is niet op te halen; dat levert een rapportage
    // zonder cijfers op en die hoort niet vanzelf te ontstaan.
    expect(hasConfiguredSource(link({ ga4_property_id: "123" }))).toBe(false);
  });

  it("accepteert ook een koppeling zonder GA4 maar met een andere bron", () => {
    expect(
      hasConfiguredSource(link({ gsc_site_url: "https://voorbeeld.nl/" })),
    ).toBe(true);
    expect(hasConfiguredSource(link({ gbp_location_id: "locations/1" }))).toBe(
      true,
    );
    expect(hasConfiguredSource(link({ ads_customer_id: "123-456" }))).toBe(
      true,
    );
  });

  it("slaat een koppeling zonder enige bron over", () => {
    expect(hasConfiguredSource(link({}))).toBe(false);
  });
});

describe("pendingReportDeals", () => {
  const links = [
    link({ deal_id: 12, ga4_connection_id: "a", ga4_property_id: "1" }),
    link({ deal_id: 9, ga4_connection_id: "a", ga4_property_id: "2" }),
    link({ deal_id: 10, ga4_connection_id: "a", ga4_property_id: "3" }),
    link({ deal_id: 11 }),
  ];

  it("laat een maand die al een rapportage heeft met rust", () => {
    // Genereren is een upsert die de status terugzet naar concept en de
    // geschreven samenvatting overschrijft. Overslaan is hier het hele punt.
    expect(pendingReportDeals({ links, reportedDealIds: [9, 10] })).toEqual([
      12,
    ]);
  });

  it("pakt op in vaste volgorde, zodat aanroepen elkaar aanvullen", () => {
    expect(
      pendingReportDeals({ links, reportedDealIds: [], limit: 2 }),
    ).toEqual([9, 10]);
    expect(
      pendingReportDeals({ links, reportedDealIds: [9, 10], limit: 2 }),
    ).toEqual([12]);
  });

  it("laat opdracht 11 staan: wel een koppeling, geen ingestelde bron", () => {
    expect(pendingReportDeals({ links, reportedDealIds: [] })).not.toContain(
      11,
    );
  });

  it("geeft niets terug als alles al gedaan is", () => {
    expect(
      pendingReportDeals({ links, reportedDealIds: [9, 10, 11, 12] }),
    ).toEqual([]);
  });
});

describe("runScheduledReports", () => {
  it("laat een mislukte klant de rest niet tegenhouden", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("Google-koppeling verlopen"))
      .mockResolvedValueOnce({ id: 3 });

    const outcomes = await runScheduledReports({
      dealIds: [8, 9, 10],
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(outcomes).toEqual([
      { dealId: 8, ok: true },
      { dealId: 9, ok: false, error: "Google-koppeling verlopen" },
      { dealId: 10, ok: true },
    ]);
  });
});
