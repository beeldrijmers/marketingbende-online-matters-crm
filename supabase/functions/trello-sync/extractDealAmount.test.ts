import { describe, it, expect } from "vitest";
import { extractDealAmount } from "./extractDealAmount";

describe("extractDealAmount", () => {
  it("reads a EUR amount from the description", () => {
    expect(
      extractDealAmount(
        "Frisian Motors - SEO Starterspakket",
        "**Pakket:** SEO Starterspakket - EUR 300 excl. BTW per maand",
      ),
    ).toBe(300);
  });

  it("handles the Dutch thousands separator (2.250 = 2250)", () => {
    expect(
      extractDealAmount("", "Webshop (Shopify) - EUR 2.250 excl. btw"),
    ).toBe(2250);
  });

  it("reads a € amount with a trailing dash", () => {
    expect(extractDealAmount("", "Deze kost €2500,- eenmalig")).toBe(2500);
  });

  it("prefers the price in the card name over the description", () => {
    expect(
      extractDealAmount(
        "Zorgbroeder - Shopify store (eenmalig 2.250 excl. btw)",
        "Losse tekst met EUR 150 ergens genoemd",
      ),
    ).toBe(2250);
  });

  it("reads a bare amount followed by 'excl. btw' (no currency symbol)", () => {
    expect(extractDealAmount("De Baron (eenmalig 750 excl. btw)", "")).toBe(
      750,
    );
  });

  it("takes the first of a range ('EUR 250 tot 300')", () => {
    expect(extractDealAmount("", "Starterspakket - EUR 250 tot 300 p/m")).toBe(
      250,
    );
  });

  it("does not treat page counts as prices", () => {
    expect(
      extractDealAmount(
        "",
        "~10 pagina's/blogs p/m - inclusief keyword research",
      ),
    ).toBeNull();
  });

  it("returns null when there is no price", () => {
    expect(
      extractDealAmount("Zadelmakerij - website", "Contactformulier fixen"),
    ).toBeNull();
  });

  it("parses a decimal comma amount", () => {
    expect(extractDealAmount("", "Prijs: EUR 1.500,50 excl. btw")).toBe(1501);
  });

  it("reads a bare amount followed by the word 'euro'", () => {
    expect(extractDealAmount("", "voor 2.750 euro excl. btw")).toBe(2750);
  });

  it("reads a number followed by the EUR code", () => {
    expect(extractDealAmount("", "budget van 2500 EUR")).toBe(2500);
  });

  it("does not treat 'european' as a euro amount", () => {
    expect(extractDealAmount("", "500 european customers")).toBeNull();
  });

  it("uses the newest explicitly labelled comment correction", () => {
    expect(
      extractDealAmount("SEO pakket € 250 p/m", "", [
        "Oud bedrag: € 275 per maand",
        "Definitief bedrag: € 300 per maand",
      ]),
    ).toBe(300);
  });

  it("uses an explicitly labelled comment without letting casual history beat the title", () => {
    expect(extractDealAmount("Project", "", ["Tarief: € 700 eenmalig"])).toBe(
      700,
    );
    expect(
      extractDealAmount("Project € 900", "", ["Oude offerte was € 700"]),
    ).toBe(900);
  });

  it("does not accept an explicitly labelled hourly rate as the deal total", () => {
    expect(
      extractDealAmount("Project", "", [
        "Definitief tarief: €75 per uur; totaal volgt na akkoord.",
      ]),
    ).toBeNull();
  });

  it("does not mistake an hourly estimate awaiting approval for the total deal value", () => {
    expect(
      extractDealAmount(
        "Hunting XL — offerte laten goedkeuren",
        "De software kost 80 excl. btw; laat weten hoeveel uur je ermee bezig bent.",
        ["Raming: 7 uur à €75. Eerst expliciet startakkoord ophalen."],
      ),
    ).toBeNull();
  });
});
