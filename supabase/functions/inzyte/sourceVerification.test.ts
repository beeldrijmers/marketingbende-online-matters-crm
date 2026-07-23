import { describe, expect, it } from "vitest";

import { verifySelectedSources } from "./sourceVerification.ts";

const input = {
  websiteUrl: "https://voorbeeld.nl/",
  ga4ConnectionId: "11111111-1111-4111-8111-111111111111",
  ga4PropertyId: "123456789",
  gscSiteUrl: null,
  gbpLocationId: null,
  adsCustomerId: null,
};

describe("verifySelectedSources", () => {
  it("accepts a GA4 property only when the live account returns it", () => {
    expect(
      verifySelectedSources(input, {
        properties: {
          ok: true,
          data: {
            properties: [
              { propertyId: "123456789", displayName: "Voorbeeld GA4" },
            ],
          },
        },
      }).ga4,
    ).toEqual({
      propertyId: "123456789",
      propertyName: "Voorbeeld GA4",
    });
  });

  it("rejects manually supplied identifiers that are absent live", () => {
    expect(() =>
      verifySelectedSources(input, {
        properties: { ok: true, data: { properties: [] } },
      }),
    ).toThrow(/niet in de live bronnen/i);
  });

  it("rejects a Search Console site for another customer domain", () => {
    expect(() =>
      verifySelectedSources(
        {
          ...input,
          ga4PropertyId: null,
          gscSiteUrl: "sc-domain:anderedomein.nl",
        },
        {
          searchConsole: {
            ok: true,
            data: { sites: [{ siteUrl: "sc-domain:anderedomein.nl" }] },
          },
        },
      ),
    ).toThrow(/hoort niet bij voorbeeld\.nl/i);
  });

  it("normalizes a live Google Ads customer id", () => {
    expect(
      verifySelectedSources(
        {
          ...input,
          ga4PropertyId: null,
          adsCustomerId: "123-456-7890",
        },
        {
          googleAds: {
            ok: true,
            data: {
              accounts: [
                {
                  customerId: "1234567890",
                  descriptiveName: "Voorbeeld Ads",
                  loginCustomerId: "999-888-7777",
                },
              ],
            },
          },
        },
      ).ads,
    ).toEqual({
      customerId: "1234567890",
      accountName: "Voorbeeld Ads",
      loginCustomerId: "9998887777",
    });
  });
});
