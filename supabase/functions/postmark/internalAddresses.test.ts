import { describe, it, expect } from "vitest";
import { isInternalEmail } from "./internalAddresses";

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
