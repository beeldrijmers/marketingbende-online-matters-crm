// @vitest-environment node
import { describe, it, expect } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions"
// project (the Deno source imports use .ts).
import { chooseAdministration } from "./chooseAdministration";

const marketingbende = { id: "478715071487280295", name: "Marketingbende" };
const other = { id: "999999999999999999", name: "Andere BV" };

describe("chooseAdministration", () => {
  it("rejects a token without administrations", () => {
    expect(chooseAdministration([])).toEqual({ outcome: "none" });
  });

  it("implicitly picks the only administration", () => {
    expect(chooseAdministration([marketingbende])).toEqual({
      outcome: "chosen",
      administration: marketingbende,
    });
  });

  it("returns the list when several administrations are accessible", () => {
    expect(chooseAdministration([marketingbende, other])).toEqual({
      outcome: "ambiguous",
      administrations: [marketingbende, other],
    });
  });

  it("honors an explicit choice the token can access", () => {
    expect(chooseAdministration([marketingbende, other], other.id)).toEqual({
      outcome: "chosen",
      administration: other,
    });
  });

  it("rejects an explicit choice the token cannot access", () => {
    expect(
      chooseAdministration([marketingbende], "123456789012345678"),
    ).toEqual({ outcome: "not_accessible" });
  });

  it("rejects an explicit choice even when it is the only mismatch (no fallback)", () => {
    // Never silently bind to a different administration than the user asked
    // for: documents would land in the wrong bookkeeping.
    expect(chooseAdministration([other], marketingbende.id)).toEqual({
      outcome: "not_accessible",
    });
  });
});
