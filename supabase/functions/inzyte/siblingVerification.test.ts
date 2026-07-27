import { describe, expect, it } from "vitest";

import { siblingVerificationMatch } from "./siblingVerification";

const link = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 13,
    company_id: 27,
    ga4_property_id: "544101716",
    gsc_site_url: null,
    gbp_location_id: null,
    ads_customer_id: null,
    ...overrides,
  }) as never;

describe("siblingVerificationMatch", () => {
  it("vindt de andere opdrachten van dezelfde klant met dezelfde property", () => {
    // Hunting XL had vier opdrachten met exact deze property.
    expect(siblingVerificationMatch(link(), "ga4_verified_at")).toEqual({
      companyId: 27,
      column: "ga4_property_id",
      value: "544101716",
    });
  });

  it("gebruikt per bron het juiste kenmerk", () => {
    expect(
      siblingVerificationMatch(
        link({ gsc_site_url: "sc-domain:huntingxl.nl" }),
        "gsc_verified_at",
      ),
    ).toMatchObject({
      column: "gsc_site_url",
      value: "sc-domain:huntingxl.nl",
    });
    expect(
      siblingVerificationMatch(
        link({ ads_customer_id: "123-456" }),
        "ads_verified_at",
      ),
    ).toMatchObject({ column: "ads_customer_id", value: "123-456" });
  });

  it("doet niets zonder klant of zonder bron-id", () => {
    // Dan blijft de bevestiging bij deze ene opdracht; beter dan gokken.
    expect(
      siblingVerificationMatch(link({ company_id: null }), "ga4_verified_at"),
    ).toBeNull();
    expect(
      siblingVerificationMatch(
        link({ ga4_property_id: null }),
        "ga4_verified_at",
      ),
    ).toBeNull();
    expect(
      siblingVerificationMatch(
        link({ ga4_property_id: "   " }),
        "ga4_verified_at",
      ),
    ).toBeNull();
    expect(siblingVerificationMatch(link(), "gsc_verified_at")).toBeNull();
  });
});
