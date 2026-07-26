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

  it("splits on a colon, the board's status-style title format", () => {
    expect(
      extractCompanyName(
        "[WEBSITE] ASP Noard: staging klaar, wacht op content en klantakkoord",
      ),
    ).toBe("ASP Noard");
    expect(
      extractCompanyName("voodoo.software: voorstel ligt er, wacht op reactie"),
    ).toBe("voodoo.software");
    expect(
      extractCompanyName("Kleine Woningen / Mosana: Rick belt voor intake"),
    ).toBe("Kleine Woningen / Mosana");
  });

  it("takes whichever separator comes first", () => {
    expect(extractCompanyName("Hunting XL: Jack Pyke-import, 755 euro")).toBe(
      "Hunting XL",
    );
    expect(extractCompanyName("MB Roofing - SEO: augustus")).toBe("MB Roofing");
  });

  it("does not split on a colon with nothing after it", () => {
    expect(extractCompanyName("Bouwiva:")).toBe("Bouwiva:");
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

  it("treats a planning bucket as internal instead of as a client", () => {
    expect(
      resolveCompanyName({
        id: "unknown-card-id",
        name: "[SEO MAAND] Augustus 2026: bevestigd, klaar om in te plannen",
      }),
    ).toBe(INTERNAL_COMPANY_NAME);
    expect(
      resolveCompanyName({ id: "unknown-card-id", name: "MAAND JUNI - taken" }),
    ).toBe(INTERNAL_COMPANY_NAME);
    expect(
      resolveCompanyName({ id: "unknown-card-id", name: "Q3 2026: planning" }),
    ).toBe(INTERNAL_COMPANY_NAME);
  });

  it("does not mistake a client whose name merely contains a year", () => {
    expect(
      resolveCompanyName({ id: "unknown-card-id", name: "Expo 2026 BV: site" }),
    ).toBe("Expo 2026 BV");
  });
  // De negen shell-bedrijven van 26 juli. Deze kaarten leverden allemaal hun
  // eigen "klant" op; de override stuurt ze naar het echte dossier. Zonder deze
  // regels maakt fase 2 van de backfill (gesloten kaarten met bijlagen) het
  // opgeruimde record binnen enkele uren opnieuw aan.
  it("stuurt de opgeruimde shell-kaarten naar het echte bedrijf", () => {
    const verwacht: Record<string, string> = {
      "69a71bde32065874a0b347b1": "Happr.nl",
      "69ca6f487459e362ecc59f43": "Happr.nl",
      "6998297c40bad0a258ac8000": "Happr.nl",
      "6981fc44f725533690b2e08e": "Happr.nl",
      "698baf3a0b8f0b401535a389": "Happr.nl",
      "6980a0a559d6ef54e0ec9f90": "Happr.nl",
      "69c0f80b624281e798c6e901": "IJntema",
      "6981fa924142384cd7d51659": "Little Stitchies",
      "69c63cabed699aad7b5334e5": "Zadelmakerij van den Bosch",
      "6979f9c98f56cc0be3a8a0ca": "Online Matters",
    };
    for (const [id, bedrijf] of Object.entries(verwacht)) {
      expect(resolveCompanyName({ id, name: "titel doet hier niet mee" })).toBe(
        bedrijf,
      );
    }
  });

  it("laat de bordeigen naslag- en templatekaarten intern", () => {
    for (const id of ["6a5f5157fdbc2443e45932d5", "6a5f64e9ddc129b2a8bba70a"]) {
      expect(resolveCompanyName({ id, name: "[START HIER] Werkwijze" })).toBe(
        INTERNAL_COMPANY_NAME,
      );
    }
  });

  // De regressie die deze ronde aanleiding gaf: de override voor de open Google
  // Reserve-kaart wees naar de shell-naam zelf, dus die maakte het bedrijf dat
  // net was opgeruimd meteen opnieuw aan.
  it("verwijst geen enkele override nog naar een opgeruimde shell-naam", () => {
    const opgeruimd = [
      "Google Reserve",
      "puntje google reserve",
      "Thessa",
      "Feedback eerste klanten",
      "Tracking mbt Meta / Tag",
      "Website support",
      "Supportmail",
      "Zoekwoorden onderzoek pagina's",
      "Little Stitchies aanpassingen website",
      "Nieuwe eenmalige opdracht",
    ];
    expect(
      Object.values(COMPANY_NAME_OVERRIDES).filter((naam) =>
        opgeruimd.includes(naam),
      ),
    ).toEqual([]);
  });
});
