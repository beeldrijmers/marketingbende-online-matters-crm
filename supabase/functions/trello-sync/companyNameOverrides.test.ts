import { describe, it, expect } from "vitest";
import {
  extractCompanyName,
  resolveCompanyName,
  COMPANY_NAME_OVERRIDES,
} from "./companyNameOverrides";
import { INTERNAL_COMPANY_NAME } from "./trelloListMaps";

describe("extractCompanyName", () => {
  it("strips a leading 'GO - ' prefix before splitting", () => {
    expect(extractCompanyName("GO - Auto Siero - WhatsApp automation")).toBe(
      "Auto Siero",
    );
  });

  it("is case-insensitive for the 'GO - ' prefix", () => {
    expect(extractCompanyName("go - Auto Siero - WhatsApp automation")).toBe(
      "Auto Siero",
    );
  });

  it("strips all standardized workflow/category title tags", () => {
    expect(
      extractCompanyName(
        "[LEAD][SEO] Frisian Motors — scope, prijs en akkoord bepalen",
      ),
    ).toBe("Frisian Motors");
    expect(
      extractCompanyName("[WEBSITE/SEO] Online Matters — klaar voor akkoord"),
    ).toBe("Online Matters");
  });

  it("takes the substring before the first ' - '", () => {
    expect(extractCompanyName("MB Roofing - SEO")).toBe("MB Roofing");
  });

  it("returns the whole title when there is no ' - ' separator", () => {
    expect(extractCompanyName("DJ Supply")).toBe("DJ Supply");
  });

  it.each(["–", "—"])(
    "accepts a spaced %s separator without turning the project title into a company",
    (separator) => {
      expect(extractCompanyName(`Bouwiva ${separator} website afgerond`)).toBe(
        "Bouwiva",
      );
    },
  );

  it("does not split on a hyphen without surrounding spaces", () => {
    expect(extractCompanyName("Autobedrijf vd Vegt migreren")).toBe(
      "Autobedrijf vd Vegt migreren",
    );
  });
});

describe("resolveCompanyName", () => {
  it("uses the override map when a card id is listed", () => {
    const overriddenId = Object.keys(COMPANY_NAME_OVERRIDES)[0];
    expect(
      resolveCompanyName({ id: overriddenId, name: "irrelevant title" }),
    ).toBe(COMPANY_NAME_OVERRIDES[overriddenId]);
  });

  it("falls back to extractCompanyName for unlisted card ids", () => {
    expect(
      resolveCompanyName({ id: "unknown-card-id", name: "Borg Hekwerk - SEO" }),
    ).toBe("Borg Hekwerk");
  });

  it("routes internal/reference cards to the internal catch-all company", () => {
    expect(
      resolveCompanyName({
        id: "6a43de9e1263dc26cb1686b6",
        name: "image.png",
      }),
    ).toBe(INTERNAL_COMPANY_NAME);
  });
});
