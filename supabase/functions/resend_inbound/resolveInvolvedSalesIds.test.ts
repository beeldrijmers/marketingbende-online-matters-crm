import { describe, it, expect } from "vitest";
import { resolveInvolvedSalesIds } from "./resolveInvolvedSalesIds";

const team = new Map<string, number>([
  ["info@marketingbende.nl", 1],
  ["info@onlinematters.nl", 2],
]);

describe("resolveInvolvedSalesIds", () => {
  it("returns every team member found in the envelope, deduplicated", () => {
    const envelope = [
      "info@marketingbende.nl",
      "klant@bedrijf.nl",
      "info@onlinematters.nl",
      "info@marketingbende.nl",
    ];
    expect(resolveInvolvedSalesIds(envelope, team)).toEqual([1, 2]);
  });

  it("matches case-insensitively and ignores non-team addresses", () => {
    expect(
      resolveInvolvedSalesIds(["Info@OnlineMatters.nl", "vreemde@x.nl"], team),
    ).toEqual([2]);
  });

  it("returns an empty list when no team member is on the mail", () => {
    expect(resolveInvolvedSalesIds(["klant@bedrijf.nl"], team)).toEqual([]);
  });
});
