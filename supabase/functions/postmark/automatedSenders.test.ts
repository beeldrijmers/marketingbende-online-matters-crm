import { describe, expect, it } from "vitest";

import { isAutomatedAddress, isBulkMail } from "./automatedSenders";

describe("isAutomatedAddress", () => {
  it.each([
    "noreply@supabase.com",
    "no-reply@github.com",
    "do-not-reply@trello.com",
    "sc-noreply@google.com",
    "googlebase-noreply@google.com",
    "noreply-accounts@google.com",
    "bounces+7213@sendgrid.net",
    "MAILER-DAEMON@mail.example.com",
    "postmaster@example.com",
    "notifications@github.com",
    "ci_activity@noreply.github.com",
    "marketingbende-online-matters-crm@noreply.github.com",
  ])("recognises %s as machine mail", (address) => {
    expect(isAutomatedAddress(address)).toBe(true);
  });

  it.each([
    "info@huntingxl.nl",
    "support@bouwiva.nl",
    "john@marketingbende.nl",
    "rick@onlinematters.nl",
    "administratie@stookmeesters.nl",
    // A person whose name happens to contain one of the words.
    "arno.bouncehouse@example.nl",
    "notificatiebeheer.klant@example.nl",
  ])("leaves %s alone", (address) => {
    expect(isAutomatedAddress(address)).toBe(false);
  });

  it("does not choke on a missing or malformed address", () => {
    expect(isAutomatedAddress("")).toBe(false);
    expect(isAutomatedAddress("geen-adres")).toBe(false);
  });
});

describe("isBulkMail", () => {
  it("recognises a newsletter from its unsubscribe header", () => {
    expect(isBulkMail({ "List-Unsubscribe": "<https://x.test/u>" })).toBe(true);
    expect(
      isBulkMail([{ name: "list-unsubscribe", value: "<mailto:u@x.test>" }]),
    ).toBe(true);
  });

  it("recognises bulk precedence and robot-sent mail", () => {
    expect(isBulkMail({ Precedence: "bulk" })).toBe(true);
    expect(isBulkMail({ "Auto-Submitted": "auto-generated" })).toBe(true);
    expect(isBulkMail({ "Feedback-ID": "1:2:3:mailer" })).toBe(true);
  });

  it("treats a normal message as normal", () => {
    expect(isBulkMail({ Subject: "Re: staging", "Auto-Submitted": "no" })).toBe(
      false,
    );
    expect(isBulkMail([{ name: "from", value: "klant@example.nl" }])).toBe(
      false,
    );
  });

  it("never fires when the provider supplies no headers", () => {
    expect(isBulkMail(undefined)).toBe(false);
    expect(isBulkMail(null)).toBe(false);
    expect(isBulkMail({})).toBe(false);
    expect(isBulkMail([])).toBe(false);
  });
});
