// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gatherClientParticipants } from "./gatherParticipants";

const inboundEmail = "intake@inbound.example.com";
const salesEmails = ["sales@marketingbende.nl", "team@onlinematters.nl"];

describe("gatherClientParticipants", () => {
  it("keeps only client recipients, dropping team and inbound addresses", () => {
    const result = gatherClientParticipants({
      recipients: [
        { Email: "klant@acme.com", Name: "Klant Acme" },
        { Email: "SALES@marketingbende.nl", Name: "Sales" },
        { Email: inboundEmail.toUpperCase(), Name: "" },
      ],
      salesEmails,
      inboundEmail,
    });
    expect(result.map((c) => c.email)).toEqual(["klant@acme.com"]);
  });

  it("de-duplicates by email (case-insensitive)", () => {
    const result = gatherClientParticipants({
      recipients: [
        { Email: "Klant@acme.com", Name: "Klant" },
        { Email: "klant@acme.com", Name: "Klant Dup" },
      ],
      salesEmails,
      inboundEmail,
    });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("klant@acme.com");
  });

  it("returns multiple distinct client participants", () => {
    const result = gatherClientParticipants({
      recipients: [
        { Email: "a@acme.com", Name: "A" },
        { Email: "b@beta.nl", Name: "B" },
        { Email: "sales@marketingbende.nl", Name: "Sales" },
      ],
      salesEmails,
      inboundEmail,
    });
    expect(result.map((c) => c.email).sort()).toEqual([
      "a@acme.com",
      "b@beta.nl",
    ]);
  });

  it("returns an empty array when only team/inbound addresses are present", () => {
    expect(
      gatherClientParticipants({
        recipients: [
          { Email: inboundEmail, Name: "" },
          { Email: "team@onlinematters.nl", Name: "Team" },
        ],
        salesEmails,
        inboundEmail,
      }),
    ).toEqual([]);
  });
});
