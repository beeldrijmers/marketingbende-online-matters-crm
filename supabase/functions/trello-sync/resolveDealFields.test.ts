import { describe, it, expect } from "vitest";
import {
  resolveCategory,
  resolveCategoryWithSource,
  resolveStage,
  resolveDealName,
  resolveIsInternal,
  resolveRevenuePeriod,
} from "./resolveDealFields";

describe("resolveCategory", () => {
  it("uses a standardized title prefix now that lists encode workflow", () => {
    expect(
      resolveCategoryWithSource(
        "69b56f4098ee1bc8c55e21ec",
        [],
        "[SEO/GEO] Mosana — maandwerk",
      ),
    ).toEqual({ category: "seo", source: "title" });
    expect(
      resolveCategoryWithSource(
        "6979f9b306e4dba9dc5182fa",
        ["Pipeline"],
        "[LEAD][SEO] Frisian Motors — scope bepalen",
      ),
    ).toEqual({ category: "seo", source: "title" });
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

  it("uses only explicit fixed wording when labels and lists are absent", () => {
    expect(
      resolveCategoryWithSource(
        "unknown",
        [],
        "Pakket: SEO - EUR 300 per maand",
      ),
    ).toEqual({ category: "seo", source: "text" });
    expect(
      resolveCategory("unknown", [], "We moeten iets met vindbaarheid doen"),
    ).toBe("overig");
  });

  it("lets an explicit label outrank contradictory comment text", () => {
    expect(
      resolveCategoryWithSource(
        "unknown",
        ["Eenmalig"],
        "Oud comment: pakket: SEO",
      ),
    ).toEqual({ category: "eenmalig", source: "label" });
  });

  it("lets a standardized title outrank a generic one-off label", () => {
    expect(
      resolveCategoryWithSource(
        "69c0f7bd1a66e8c764d484ee",
        ["Eenmalig"],
        "[WEBSHOP] Nieuwe productcatalogus",
      ),
    ).toEqual({ category: "website-development", source: "title" });
    expect(
      resolveCategoryWithSource(
        "69c0f7bd1a66e8c764d484ee",
        ["Eenmalig"],
        "[WEBSITE/SEO] Online Matters — klaar voor akkoord",
      ),
    ).toEqual({ category: "website-development", source: "title" });
  });
});

describe("resolveStage", () => {
  it("uses the direct list-to-stage mapping for genuine stage lists", () => {
    expect(resolveStage("6a40ed3ab091e5e140319312", [], false)).toBe("on-hold");
  });

  it("maps the confirmed and review lists to their explicit stages", () => {
    expect(resolveStage("69b56f4098ee1bc8c55e21ec", [], false)).toBe(
      "bevestigd-inplannen",
    );
    expect(resolveStage("69c0f7bd1a66e8c764d484ee", [], false)).toBe(
      "controle-livegang",
    );
  });

  it("maps ready work to the billing stage regardless of revenue type", () => {
    expect(resolveStage("6979f9a8a825b6ff46306ecf", ["SEO"], false)).toBe(
      "facturatie-live",
    );
  });

  it("keeps running subscriptions in the monthly workflow stage", () => {
    expect(resolveStage("6979f9dd197030f0766dfaa5", ["SEO"], false)).toBe(
      "maandelijks",
    );
  });

  it("still sends a completed monthly cycle through won", () => {
    expect(resolveStage("6982ffae219bd60c27be88b5", ["SEO"], false)).toBe(
      "won",
    );
  });

  it("uses completion metadata only as a fallback for an unknown list", () => {
    expect(resolveStage("future-list", ["Eenmalig", "Afgerond"], false)).toBe(
      "won",
    );
    expect(resolveStage("future-list", ["Eenmalig"], true)).toBe("won");
  });

  it("puts a new unknown list in Nieuw instead of a late workflow phase", () => {
    expect(resolveStage("future-list", [], false)).toBe("informatie-pipeline");
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
  it("recognizes an explicit monthly price in otherwise unclassified work", () => {
    expect(resolveRevenuePeriod("overig", "SEO beheer voor € 50 p/m")).toBe(
      "maandelijks",
    );
  });
  it("recognizes one-off wording in a description or comment", () => {
    expect(resolveRevenuePeriod("overig", "Dit kost eenmalig € 750")).toBe(
      "eenmalig",
    );
    expect(resolveRevenuePeriod("overig", ["One-off klus", "per maand"])).toBe(
      "eenmalig",
    );
  });
  it("uses the first unambiguous source and refuses conflicting prose", () => {
    expect(
      resolveRevenuePeriod("overig", [
        "Definitief: maandelijks",
        "Oude offerte: eenmalig",
      ]),
    ).toBe("maandelijks");
    expect(
      resolveRevenuePeriod("overig", "Keuze: eenmalig of per maand"),
    ).toBeNull();
  });
  it("lets an explicit one-off category win over wording in the card", () => {
    expect(resolveRevenuePeriod("eenmalig", "nazorg per maand bespreken")).toBe(
      "eenmalig",
    );
  });
  it("ignores recurring work that is explicitly excluded from the assignment", () => {
    expect(
      resolveRevenuePeriod(
        "overig",
        "B2B-inrichting en een terugkerende prijs-/voorraadsynchronisatie vallen hier niet onder.",
      ),
    ).toBeNull();
  });
});

describe("resolveIsInternal", () => {
  it("classifies Happr product work as internal", () => {
    expect(
      resolveIsInternal({
        category: "happr",
        dealName: "Happr reserveringswidget",
        companyName: "Restaurant Happie",
      }),
    ).toBe(true);
  });

  it("classifies the Lightspeed POS integration as internal", () => {
    expect(
      resolveIsInternal({
        category: "overig",
        dealName: "Koppeling Lightspeed kassa",
        companyName: "Extern Bedrijf",
      }),
    ).toBe(true);
  });

  it("classifies Marketingbende/Online Matters own work as internal", () => {
    expect(
      resolveIsInternal({
        category: "seo",
        dealName: "SEO eigen site",
        companyName: "Marketingbende (intern)",
      }),
    ).toBe(true);
    expect(
      resolveIsInternal({
        category: "seo",
        dealName: "SEO migratie",
        companyName: "Online Matters",
      }),
    ).toBe(true);
  });

  it("classifies regular client work as external", () => {
    expect(
      resolveIsInternal({
        category: "seo",
        dealName: "MB Roofing - SEO",
        companyName: "MB Roofing",
      }),
    ).toBe(false);
  });
});
