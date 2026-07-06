import { describe, it, expect } from "vitest";
import {
  resolveCategory,
  resolveStage,
  resolveDealName,
  resolveRevenuePeriod,
} from "./resolveDealFields";

describe("resolveCategory", () => {
  it("uses the category-list mapping when the list encodes a category", () => {
    expect(resolveCategory("6982ffae219bd60c27be88b5", [])).toBe("eenmalig");
  });

  it("falls back to a label mapping for genuine stage lists", () => {
    expect(resolveCategory("6979f9dd197030f0766dfaa5", ["SEO"])).toBe("seo");
  });

  it("ignores labels with no category mapping (e.g. Pipeline, Afgerond)", () => {
    expect(resolveCategory("6979f9b306e4dba9dc5182fa", ["Pipeline"])).toBe(
      "overig",
    );
  });

  it("defaults to 'overig' when no label matches", () => {
    expect(resolveCategory("6979f9a8a825b6ff46306ecf", ["Afgerond"])).toBe(
      "overig",
    );
  });
});

describe("resolveStage", () => {
  it("uses the direct list-to-stage mapping for genuine stage lists", () => {
    expect(resolveStage("6a40ed3ab091e5e140319312", [], false)).toBe("on-hold");
  });

  it("defaults category-list cards to facturatie-live", () => {
    expect(resolveStage("6982ffae219bd60c27be88b5", ["Eenmalig"], false)).toBe(
      "facturatie-live",
    );
  });

  it("resolves category-list cards with the Afgerond label to won", () => {
    expect(
      resolveStage("6982ffae219bd60c27be88b5", ["Eenmalig", "Afgerond"], false),
    ).toBe("won");
  });

  it("resolves category-list cards marked dueComplete to won", () => {
    expect(resolveStage("6982ffae219bd60c27be88b5", ["Eenmalig"], true)).toBe(
      "won",
    );
  });
});

describe("resolveDealName", () => {
  it("strips a leading 'GO - ' prefix but keeps the rest of the title intact", () => {
    expect(resolveDealName("GO - Auto Siero - WhatsApp automation")).toBe(
      "Auto Siero - WhatsApp automation",
    );
  });

  it("leaves titles without the noise prefix unchanged", () => {
    expect(resolveDealName("MB Roofing - SEO")).toBe("MB Roofing - SEO");
  });
});

describe("resolveRevenuePeriod", () => {
  it("classifies SEO as monthly recurring", () => {
    expect(resolveRevenuePeriod("seo")).toBe("maandelijks");
  });
  it("classifies project categories as one-off", () => {
    expect(resolveRevenuePeriod("eenmalig")).toBe("eenmalig");
    expect(resolveRevenuePeriod("website-development")).toBe("eenmalig");
    expect(resolveRevenuePeriod("website-optimalisatie")).toBe("eenmalig");
  });
  it("leaves internal/other categories unclassified", () => {
    expect(resolveRevenuePeriod("happr")).toBe(null);
    expect(resolveRevenuePeriod("overig")).toBe(null);
  });
});
