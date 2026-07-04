import { describe, it, expect } from "vitest";
import { extractDealIdFromEmails } from "./extractDealId";

describe("extractDealIdFromEmails", () => {
  const inboundDomain = "inbound.example.com";

  it("extracts the deal id from a matching deal alias address", () => {
    expect(
      extractDealIdFromEmails(
        [{ Email: "deal-42@inbound.example.com" }],
        inboundDomain,
      ),
    ).toBe(42);
  });

  it("is case-insensitive", () => {
    expect(
      extractDealIdFromEmails(
        [{ Email: "Deal-42@Inbound.Example.com" }],
        inboundDomain,
      ),
    ).toBe(42);
  });

  it("finds the deal alias among multiple recipients", () => {
    expect(
      extractDealIdFromEmails(
        [
          { Email: "someone@else.com" },
          { Email: "deal-7@inbound.example.com" },
        ],
        inboundDomain,
      ),
    ).toBe(7);
  });

  it("returns null when no recipient matches the deal alias pattern", () => {
    expect(
      extractDealIdFromEmails(
        [{ Email: "contact@company.com" }],
        inboundDomain,
      ),
    ).toBeNull();
  });

  it("returns null when the domain does not match the inbound domain", () => {
    expect(
      extractDealIdFromEmails(
        [{ Email: "deal-42@other-domain.com" }],
        inboundDomain,
      ),
    ).toBeNull();
  });

  it("returns null when the local part is not a valid deal alias", () => {
    expect(
      extractDealIdFromEmails(
        [{ Email: "deal-abc@inbound.example.com" }],
        inboundDomain,
      ),
    ).toBeNull();
  });

  it("returns null when inboundDomain is empty", () => {
    expect(
      extractDealIdFromEmails([{ Email: "deal-42@inbound.example.com" }], ""),
    ).toBeNull();
  });

  it("returns null for an empty emails array", () => {
    expect(extractDealIdFromEmails([], inboundDomain)).toBeNull();
  });
});
