import { describe, it, expect } from "vitest";
import {
  findCompanyMentionedInText,
  normalizeCompanyName,
} from "./matchCompanyInText";

const companies = [
  { id: 1, name: "Hunting XL" },
  { id: 2, name: "Marketingbende" },
  { id: 3, name: "De Baron" },
  { id: 4, name: "AB" },
];

describe("normalizeCompanyName", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeCompanyName("Hunting XL")).toBe("huntingxl");
    expect(normalizeCompanyName("hunting-xl")).toBe("huntingxl");
    expect(normalizeCompanyName("De Baron B.V.")).toBe("debaronbv");
  });
});

describe("findCompanyMentionedInText", () => {
  it("matches an existing customer named in the subject, ignoring spacing", () => {
    const match = findCompanyMentionedInText(
      "Aanpassingen HuntingXL 06-07-2026",
      companies,
    );
    expect(match?.id).toBe(1);
  });

  it("matches the spaced company name too", () => {
    expect(
      findCompanyMentionedInText("Update over Hunting XL project", companies)
        ?.id,
    ).toBe(1);
  });

  it("prefers the longest matching name", () => {
    const match = findCompanyMentionedInText("De Baron webshop update", [
      ...companies,
      { id: 5, name: "Baron" },
    ]);
    expect(match?.id).toBe(3); // "De Baron" (8) beats "Baron" (5)
  });

  it("ignores names shorter than the minimum length", () => {
    expect(findCompanyMentionedInText("Iets over AB vandaag", companies)).toBe(
      null,
    );
  });

  it("returns null when no company is mentioned", () => {
    expect(
      findCompanyMentionedInText("Algemene vraag zonder klantnaam", companies),
    ).toBe(null);
  });
});
