import { describe, it, expect } from "vitest";
import { isInternalDisplayName, isInternalEmail } from "./internalAddresses";

const ctx = {
  inboundEmail: "crm@inbound.marketingbende.nl",
  salesEmails: ["info@marketingbende.nl", "info@onlinematters.nl"],
};

describe("isInternalEmail", () => {
  it("treats the inbound intake address as internal", () => {
    expect(isInternalEmail("crm@inbound.marketingbende.nl", ctx)).toBe(true);
  });

  it("treats any address on the inbound subdomain as internal", () => {
    expect(isInternalEmail("noreply@inbound.marketingbende.nl", ctx)).toBe(
      true,
    );
  });

  it("treats a team-domain address as internal even if not a sales user", () => {
    expect(isInternalEmail("stagiair@marketingbende.nl", ctx)).toBe(true);
    expect(isInternalEmail("rick@onlinematters.nl", ctx)).toBe(true);
  });

  it("treats the known collaborating-party domains as internal", () => {
    expect(isInternalEmail("iemand@groeienmetads.nl", ctx)).toBe(true);
  });

  it("matches case-insensitively and trims", () => {
    expect(isInternalEmail("  Info@Marketingbende.NL ", ctx)).toBe(true);
  });

  it("treats a real client address as external", () => {
    expect(isInternalEmail("dennis@huntingxl.nl", ctx)).toBe(false);
    expect(isInternalEmail("klant@bedrijf.com", ctx)).toBe(false);
  });

  it("treats an empty/garbage address as internal (never a client)", () => {
    expect(isInternalEmail("", ctx)).toBe(true);
    expect(isInternalEmail("not-an-email", ctx)).toBe(true);
  });
});

describe("isInternalDisplayName", () => {
  const team = ["John Plantenga", "Rick Maarssen"];

  it("recognises a colleague writing from a private address", () => {
    expect(isInternalDisplayName("John Plantenga", team)).toBe(true);
    expect(isInternalDisplayName("  john   plantenga ", team)).toBe(true);
    expect(isInternalDisplayName('"Rick Maarssen"', team)).toBe(true);
  });

  it("recognises one of the parties itself", () => {
    expect(isInternalDisplayName("Groeien Met Ads", team)).toBe(true);
    expect(isInternalDisplayName("Marketingbende", team)).toBe(true);
    expect(isInternalDisplayName("Online Matters", team)).toBe(true);
  });

  it("leaves clients alone", () => {
    expect(isInternalDisplayName("Wijnand Snijder", team)).toBe(false);
    expect(isInternalDisplayName("Demi Ensing", team)).toBe(false);
    expect(isInternalDisplayName("", team)).toBe(false);
    expect(isInternalDisplayName("Jan", team)).toBe(false);
  });

  it("does not match on a partial name", () => {
    expect(isInternalDisplayName("John Plantenga Jr", team)).toBe(false);
    expect(isInternalDisplayName("John", team)).toBe(false);
  });
});
