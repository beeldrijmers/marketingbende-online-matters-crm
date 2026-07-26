import { stripMarkdown, toOneLine } from "./plainText";

describe("stripMarkdown", () => {
  it("removes the syntax a Trello description arrives with", () => {
    const input = [
      "## Nieuwe lead",
      "",
      "**Organisatie:** Kleine Woningen / Mosana",
      "**Telefoon:** +31 6 50610409",
      "",
      "- wat men aanbiedt",
      "- welke partijen men wil bereiken",
    ].join("\n");

    expect(stripMarkdown(input)).toBe(
      [
        "Nieuwe lead",
        "",
        "Organisatie: Kleine Woningen / Mosana",
        "Telefoon: +31 6 50610409",
        "",
        "wat men aanbiedt",
        "welke partijen men wil bereiken",
      ].join("\n"),
    );
  });

  it("keeps the words of a link and drops the target", () => {
    expect(
      stripMarkdown("Zie [de staging](https://staging.example.nl) hier"),
    ).toBe("Zie de staging hier");
    expect(stripMarkdown("![logo](https://x.test/logo.png) staat live")).toBe(
      "staat live",
    );
  });

  it("handles emphasis without eating ordinary punctuation", () => {
    expect(stripMarkdown("*klaar* en __af__ en ~~weg~~")).toBe(
      "klaar en af en weg",
    );
    expect(stripMarkdown("prijs 3*4 en snake_case_naam blijft")).toBe(
      "prijs 3*4 en snake_case_naam blijft",
    );
  });

  it("leaves plain text exactly as it is", () => {
    const plain = "Staging klaar, wacht op content en klantakkoord.";
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it("survives nothing at all", () => {
    expect(stripMarkdown(null)).toBe("");
    expect(stripMarkdown(undefined)).toBe("");
    expect(stripMarkdown("")).toBe("");
  });

  it("collapses to one line for a snippet", () => {
    expect(toOneLine("## Kop\n\nEerste regel\nTweede regel")).toBe(
      "Kop Eerste regel Tweede regel",
    );
  });
});
