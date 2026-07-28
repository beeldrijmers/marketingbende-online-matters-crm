import { describe, expect, it } from "vitest";
import { matchSearchConsoleSite, normalizeHost } from "./autoMatchSources.ts";

describe("normalizeHost", () => {
  it("haalt protocol, www, pad en sc-domain-voorvoegsel weg", () => {
    expect(normalizeHost("https://www.mbroofing.nl/dakdekker/")).toBe(
      "mbroofing.nl",
    );
    expect(normalizeHost("sc-domain:mbroofing.nl")).toBe("mbroofing.nl");
    expect(normalizeHost("http://mbroofing.nl")).toBe("mbroofing.nl");
  });

  it("geeft leeg terug bij onbruikbare invoer", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost("   ")).toBe("");
  });
});

describe("matchSearchConsoleSite", () => {
  it("kiest de domeinproperty boven een URL-voorvoegsel", () => {
    const result = matchSearchConsoleSite("https://mbroofing.nl", [
      { siteUrl: "https://mbroofing.nl/" },
      { siteUrl: "sc-domain:mbroofing.nl" },
    ]);
    expect(result).toEqual({
      siteUrl: "sc-domain:mbroofing.nl",
      reason: "matched",
    });
  });

  it("matcht ondanks www-verschil", () => {
    const result = matchSearchConsoleSite("https://www.rt-interieur.nl/", [
      { siteUrl: "https://rt-interieur.nl/" },
    ]);
    expect(result.siteUrl).toBe("https://rt-interieur.nl/");
  });

  it("koppelt nooit een andere website", () => {
    const result = matchSearchConsoleSite("https://mbroofing.nl", [
      { siteUrl: "sc-domain:borghekwerk.nl" },
      { siteUrl: "https://huntingxl.nl/" },
    ]);
    expect(result).toEqual({ siteUrl: null, reason: "no_match" });
  });

  it("weigert bij twee even goede kandidaten", () => {
    const result = matchSearchConsoleSite("https://mbroofing.nl", [
      { siteUrl: "https://mbroofing.nl/" },
      { siteUrl: "https://www.mbroofing.nl/" },
    ]);
    expect(result).toEqual({ siteUrl: null, reason: "ambiguous" });
  });

  it("slaat properties over waar we geen rechten op hebben", () => {
    const result = matchSearchConsoleSite("https://autopix.nl", [
      {
        siteUrl: "sc-domain:autopix.nl",
        permissionLevel: "siteUnverifiedUser",
      },
    ]);
    expect(result).toEqual({ siteUrl: null, reason: "no_match" });
  });

  it("meldt apart dat er geen website of geen sites zijn", () => {
    expect(
      matchSearchConsoleSite("", [{ siteUrl: "sc-domain:x.nl" }]).reason,
    ).toBe("no_website");
    expect(matchSearchConsoleSite("https://x.nl", []).reason).toBe("no_sites");
  });
});
