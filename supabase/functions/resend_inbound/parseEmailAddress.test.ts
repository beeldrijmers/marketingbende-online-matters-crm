import { describe, it, expect } from "vitest";
import {
  parseEmailAddress,
  parseEmailContact,
  parseEmailContacts,
} from "./parseEmailAddress";

describe("parseEmailAddress", () => {
  it("returns a bare address lowercased", () => {
    expect(parseEmailAddress("John@Example.COM")).toBe("john@example.com");
  });

  it("extracts the address from a display-name form", () => {
    expect(parseEmailAddress('"John Doe" <john@example.com>')).toBe(
      "john@example.com",
    );
  });

  it("returns empty string for empty input", () => {
    expect(parseEmailAddress("")).toBe("");
  });
});

describe("parseEmailContact", () => {
  it("splits display name and address", () => {
    expect(parseEmailContact('"Jane Roe" <jane@acme.nl>')).toEqual({
      Email: "jane@acme.nl",
      Name: "Jane Roe",
    });
  });

  it("keeps an empty name for a bare address", () => {
    expect(parseEmailContact("bob@acme.nl")).toEqual({
      Email: "bob@acme.nl",
      Name: "",
    });
  });

  it("handles an unquoted display name", () => {
    expect(parseEmailContact("Jane Roe <jane@acme.nl>")).toEqual({
      Email: "jane@acme.nl",
      Name: "Jane Roe",
    });
  });
});

describe("parseEmailContacts", () => {
  it("maps a list and drops entries without an address", () => {
    expect(
      parseEmailContacts(["a@x.nl", '"B" <b@x.nl>', "", "not-an-email"]),
    ).toEqual([
      { Email: "a@x.nl", Name: "" },
      { Email: "b@x.nl", Name: "B" },
      { Email: "not-an-email", Name: "" },
    ]);
  });

  it("returns an empty array for undefined", () => {
    expect(parseEmailContacts(undefined)).toEqual([]);
  });
});
