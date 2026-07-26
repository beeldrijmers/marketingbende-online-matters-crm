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

  it("uses a website mentioned in a comment when maintained fields have none", () => {
    expect(
      extractCompanyWebsite(
        "",
        [],
        ["Nieuwe website staat op https://www.voorbeeldklant.nl/live"],
      ),
    ).toBe("https://voorbeeldklant.nl");
  });
});

describe("extractCompanyWebsite and the client's own name", () => {
  it("rejects a tool link that has nothing to do with the client", () => {
    expect(
      extractCompanyWebsite(
        "Voorbeeldshop staat klaar: https://themes.shopify.com/themes/dawn",
        [],
        [],
        "Zorgbroeder",
      ),
    ).toBeNull();
    expect(
      extractCompanyWebsite(
        "Zie https://chatgpt.com/c/123",
        [],
        [],
        "Senso Care",
      ),
    ).toBeNull();
    expect(
      extractCompanyWebsite(
        "https://app.timelines.ai/inbox",
        [],
        [],
        "Auto Siero",
      ),
    ).toBeNull();
  });

  it("accepts the client's own domain, however it is written", () => {
    expect(
      extractCompanyWebsite(
        "Live op https://event-radio.nl",
        [],
        [],
        "Event Radio",
      ),
    ).toBe("https://event-radio.nl");
    expect(
      extractCompanyWebsite("https://ijntema-bv.nl", [], [], "IJntema"),
    ).toBe("https://ijntema-bv.nl");
    expect(
      extractCompanyWebsite(
        "https://huntingxl.myshopify.com/admin",
        [],
        [],
        "Hunting XL",
      ),
    ).toBe("https://huntingxl.myshopify.com");
  });

  it("keeps working when no company name is available", () => {
    expect(extractCompanyWebsite("https://bouwiva.nl", [], [])).toBe(
      "https://bouwiva.nl",
    );
  });
});
