import { describe, expect, it } from "vitest";

import { verificationFromReport } from "./verificationFromReport";

const leeg = {
  ga4: {},
  gsc: {},
  gbp: {},
  ads: {},
};

const gelukt = {
  current: { status: "success" },
  previous: { status: "success" },
};

describe("verificationFromReport", () => {
  it("stempelt een bron die daadwerkelijk data teruggaf", () => {
    expect(verificationFromReport({ link: {}, ...leeg, ga4: gelukt })).toEqual([
      "ga4_verified_at",
    ]);
  });

  it("neemt ook een bron mee waarvan maar een van de twee maanden lukte", () => {
    // Een maand met data bewijst dat de property bereikbaar is; de andere maand
    // kan simpelweg leeg zijn.
    expect(
      verificationFromReport({
        link: {},
        ...leeg,
        gsc: { current: { status: "success" }, previous: { status: "failed" } },
      }),
    ).toEqual(["gsc_verified_at"]);
  });

  it("stempelt niets bij een mislukte of overgeslagen bron", () => {
    expect(
      verificationFromReport({
        link: {},
        ...leeg,
        ga4: { current: { status: "failed" }, previous: { status: "failed" } },
        gbp: {
          current: { status: "unavailable" },
          previous: { status: "unavailable" },
        },
      }),
    ).toEqual([]);
  });

  it("laat een bestaand stempel staan in plaats van hem te verversen", () => {
    expect(
      verificationFromReport({
        link: { ga4_verified_at: "2026-07-01T10:00:00.000Z" },
        ...leeg,
        ga4: gelukt,
      }),
    ).toEqual([]);
  });

  it("doet niets zonder koppeling", () => {
    expect(
      verificationFromReport({ link: null, ...leeg, ga4: gelukt }),
    ).toEqual([]);
  });

  it("kan meerdere bronnen in een keer stempelen", () => {
    expect(
      verificationFromReport({
        link: {},
        ...leeg,
        ga4: gelukt,
        ads: gelukt,
      }),
    ).toEqual(["ga4_verified_at", "ads_verified_at"]);
  });
});
