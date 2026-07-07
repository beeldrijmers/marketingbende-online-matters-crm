import { describe, it, expect } from "vitest";
import {
  extractForwardedHeaderEmails,
  resolveInvolvedSalesIds,
} from "./resolveInvolvedSalesIds";

const team = new Map<string, number>([
  ["info@marketingbende.nl", 1],
  ["info@onlinematters.nl", 2],
]);

describe("resolveInvolvedSalesIds", () => {
  it("returns every team member in the envelope, deduplicated", () => {
    const envelope = [
      "info@marketingbende.nl",
      "klant@bedrijf.nl",
      "info@onlinematters.nl",
      "info@marketingbende.nl",
    ];
    expect(resolveInvolvedSalesIds(envelope, "", team)).toEqual([1, 2]);
  });

  it("also finds a team member that appears only in the mail body", () => {
    // Resend hides cross-domain recipients from the envelope, but the partner's
    // address is in the quoted forwarded headers.
    const envelope = [
      "info@marketingbende.nl",
      "crm@inbound.marketingbende.nl",
    ];
    const body = "Aan: info@marketingbende.nl, info@onlinematters.nl\nGroet";
    expect(resolveInvolvedSalesIds(envelope, body, team)).toEqual([1, 2]);
  });

  it("matches case-insensitively and ignores non-team addresses", () => {
    expect(
      resolveInvolvedSalesIds(
        ["Info@OnlineMatters.nl"],
        "Van: vreemde@x.nl",
        team,
      ),
    ).toEqual([2]);
  });

  it("does NOT grant access to a team member quoted only in body prose", () => {
    // A colleague's address buried in an unrelated quoted thread must not turn
    // them into a deal assignee (which would hand them RLS read access).
    const body =
      "Beste klant,\n\nZoals info@onlinematters.nl vorig jaar al schreef in een ander project...\n\nGroet";
    expect(resolveInvolvedSalesIds(["klant@bedrijf.nl"], body, team)).toEqual(
      [],
    );
  });

  it("returns an empty list when no team member is on the mail", () => {
    expect(
      resolveInvolvedSalesIds(["klant@bedrijf.nl"], "hallo", team),
    ).toEqual([]);
  });
});

describe("extractForwardedHeaderEmails", () => {
  it("reads addresses from To/Cc/Van/Aan/From header lines only", () => {
    const body = [
      "---------- Doorgestuurd bericht ----------",
      "Van: Jan Klant <jan@klant.nl>",
      "Aan: info@marketingbende.nl, Info@OnlineMatters.nl",
      "Cc: partner@extern.nl",
      "",
      "Losse tekst met een adres ruis@ergens.nl dat niet mag meetellen.",
    ].join("\n");
    expect(extractForwardedHeaderEmails(body)).toEqual([
      "jan@klant.nl",
      "info@marketingbende.nl",
      "Info@OnlineMatters.nl",
      "partner@extern.nl",
    ]);
  });

  it("also matches quoted (>) header lines", () => {
    expect(extractForwardedHeaderEmails("> To: a@b.nl")).toEqual(["a@b.nl"]);
  });

  it("ignores addresses on non-header lines", () => {
    expect(
      extractForwardedHeaderEmails(
        "Bel me op nummer of mail naar los@adres.nl",
      ),
    ).toEqual([]);
  });
});
