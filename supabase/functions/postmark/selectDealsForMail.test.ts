// @vitest-environment node
import { describe, it, expect } from "vitest";
// Import WITHOUT the .ts extension (Vitest "functions" project convention).
import { selectDealsForMail } from "./selectDealsForMail";

const website = { id: 1, name: "Website onderhoud" };
const webshop = { id: 2, name: "Webshop Hunting XL" };
const seo = { id: 3, name: "SEO traject" };

describe("selectDealsForMail", () => {
  it("keeps zero or one deal untouched", () => {
    expect(selectDealsForMail([], "wat dan ook")).toEqual([]);
    expect(selectDealsForMail([website], "los van de inhoud")).toEqual([
      website,
    ]);
  });

  it("picks the deal whose full name appears in the subject", () => {
    expect(
      selectDealsForMail(
        [website, webshop, seo],
        "Fwd: Vraag over website onderhoud volgende maand",
      ),
    ).toEqual([website]);
  });

  it("matches case-insensitively, through diacritics and punctuation", () => {
    expect(
      selectDealsForMail(
        [website, webshop],
        "Update: WÉBSHOP, Hunting-XL! gaat live",
      ),
    ).toEqual([webshop]);
  });

  it("falls back to token matching when the name is not verbatim", () => {
    // "Webshop Hunting XL": significant tokens are webshop + hunting
    // ("xl" is below the length guard). Both appear, in a different order.
    expect(
      selectDealsForMail(
        [website, webshop],
        "De hunting shop gaat goed; de webshop verkoopt prima",
      ),
    ).toEqual([webshop]);
  });

  it("returns every match when several deals fit", () => {
    expect(
      selectDealsForMail(
        [website, webshop, seo],
        "Zowel website onderhoud als het seo traject lopen door",
      ),
    ).toEqual([website, seo]);
  });

  it("falls back to ALL deals when nothing matches", () => {
    const all = [website, webshop, seo];
    expect(selectDealsForMail(all, "Factuur ontvangen, dank!")).toEqual(all);
  });

  it("treats null or stop-word-only names as non-matching (fallback)", () => {
    const unnamed = { id: 4, name: null };
    const stopOnly = { id: 5, name: "van de" };
    const all = [unnamed, stopOnly];
    expect(selectDealsForMail(all, "willekeurige tekst")).toEqual(all);
  });

  it("does not full-match very short deal names on stray words", () => {
    const shortDeal = { id: 6, name: "SEO" };
    const other = { id: 7, name: "Drukwerk" };
    // "seo" appears, so the token tier picks the SEO deal specifically.
    expect(
      selectDealsForMail([shortDeal, other], "even iets over seo gevraagd"),
    ).toEqual([shortDeal]);
    // Nothing matches: fallback to all.
    expect(
      selectDealsForMail([shortDeal, other], "algemene vraag over planning"),
    ).toEqual([shortDeal, other]);
  });
});
