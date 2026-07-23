import { describe, expect, it } from "vitest";

import type { Deal, InzyteLink } from "../../types";
import {
  getInzyteConnectionSummary,
  getInzyteSourceStates,
  matchesInzyteVerificationFilter,
} from "./inzyteVerification";

const link = (values: Partial<InzyteLink> = {}): InzyteLink =>
  ({
    id: 1,
    deal_id: 10,
    company_id: 20,
    website_url: "https://voorbeeld.nl",
    inzyte_user_id: "11111111-1111-4111-8111-111111111111",
    ga4_connection_id: null,
    ga4_connection_name: null,
    ga4_property_id: null,
    ga4_property_name: null,
    gsc_site_url: null,
    gbp_account_id: null,
    gbp_location_id: null,
    gbp_location_name: null,
    ads_customer_id: null,
    ads_account_name: null,
    ads_login_customer_id: null,
    ga4_verified_at: null,
    gsc_verified_at: null,
    gbp_verified_at: null,
    ads_verified_at: null,
    last_verified_at: null,
    last_error: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
    ...values,
  }) as InzyteLink;

const deal = (inzyteLink: InzyteLink | null): Deal =>
  ({ id: 10, name: "Voorbeeld", inzyte_link: inzyteLink }) as Deal;

describe("Inzyte-koppelbewijs", () => {
  it("treats stored identifiers as configured, never as verified", () => {
    const storedOnly = link({
      ga4_connection_id: "22222222-2222-4222-8222-222222222222",
      ga4_property_id: "123456789",
      last_verified_at: "2026-07-22T10:00:00Z",
    });

    expect(getInzyteSourceStates(storedOnly)[0]).toMatchObject({
      configured: true,
      verified: false,
    });
    expect(getInzyteConnectionSummary(storedOnly)).toMatchObject({
      label: "GA4 ingesteld, controle nodig",
      tone: "warning",
    });
  });

  it("uses green wording only after source-specific verification", () => {
    const verified = link({
      ga4_connection_id: "22222222-2222-4222-8222-222222222222",
      ga4_property_id: "123456789",
      ga4_verified_at: "2026-07-23T10:00:00Z",
    });

    expect(getInzyteConnectionSummary(verified)).toMatchObject({
      label: "GA4-bron gecontroleerd",
      tone: "success",
      verifiedCount: 1,
    });
  });

  it("filters active, review and missing assignments by evidence", () => {
    const active = deal(
      link({
        gsc_site_url: "sc-domain:voorbeeld.nl",
        gsc_verified_at: "2026-07-23T10:00:00Z",
      }),
    );
    const review = deal(
      link({
        ga4_connection_id: "22222222-2222-4222-8222-222222222222",
        ga4_property_id: "123456789",
      }),
    );
    const failed = deal(
      link({
        gsc_site_url: "sc-domain:voorbeeld.nl",
        gsc_verified_at: "2026-07-23T10:00:00Z",
        last_error: "Google gaf een fout terug",
      }),
    );
    const accountOnly = deal(link());
    const missing = deal(null);

    expect(matchesInzyteVerificationFilter(active, "active")).toBe(true);
    expect(matchesInzyteVerificationFilter(review, "active")).toBe(false);
    expect(matchesInzyteVerificationFilter(review, "review")).toBe(true);
    expect(matchesInzyteVerificationFilter(failed, "active")).toBe(false);
    expect(matchesInzyteVerificationFilter(failed, "review")).toBe(true);
    expect(matchesInzyteVerificationFilter(accountOnly, "review")).toBe(false);
    expect(matchesInzyteVerificationFilter(accountOnly, "none")).toBe(true);
    expect(matchesInzyteVerificationFilter(missing, "none")).toBe(true);
  });
});
