import { describe, it, expect } from "vitest";
import { extractCompanyWebsite } from "./extractCompanyWebsite";

describe("extractCompanyWebsite", () => {
  it("returns null when there is no url", () => {
    expect(extractCompanyWebsite("Geen link hier", [])).toBeNull();
    expect(extractCompanyWebsite("", [])).toBeNull();
  });

  it("prefers an attachment url over a description url", () => {
    expect(
      extractCompanyWebsite("zie https://blog.example.org/post", [
        "https://klant.nl/home",
      ]),
    ).toBe("https://klant.nl");
  });

  it("normalizes to https://<domain>, stripping www and paths", () => {
    expect(
      extractCompanyWebsite("Website: https://www.Klant-BV.nl/over-ons", []),
    ).toBe("https://klant-bv.nl");
  });

  it("ignores Trello and common tool/social hosts", () => {
    expect(
      extractCompanyWebsite(
        "kaart https://trello.com/c/abc en https://docs.google.com/x",
        ["https://www.linkedin.com/company/klant"],
      ),
    ).toBeNull();
  });

  it("skips ignored hosts and returns the first real client site", () => {
    expect(
      extractCompanyWebsite("", [
        "https://trello.com/c/abc",
        "https://youtu.be/xyz",
        "https://echteklant.com/contact",
      ]),
    ).toBe("https://echteklant.com");
  });

  it("ignores strings that are not valid urls", () => {
    expect(extractCompanyWebsite("mail naar info@klant.nl", [])).toBeNull();
  });
});
