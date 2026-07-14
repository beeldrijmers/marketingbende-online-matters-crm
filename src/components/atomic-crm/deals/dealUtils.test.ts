import { commands } from "vitest/browser";

import {
  buildDealInboundEmail,
  formatISODateString,
  getDealDurationDays,
  isBeforeToday,
} from "./dealUtils";

describe("formatISODateString", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("formats a valid ISO date string correctly", () => {
    const isoDate = "2024-06-15";
    const formattedDate = formatISODateString(isoDate);
    expect(formattedDate).toBe("15 jun. 2024");
  });

  it("should not shift the date regardless of timezone", async () => {
    // Uses CDP (Emulation.setTimezoneOverride) to actually change the browser's
    // timezone at runtime so we can catch regressions where someone replaces the
    // manual date-component parse with new Date(isoString), which would shift
    // dates in negative-offset timezones like America/New_York.
    const isoDate = "2024-06-15";
    await commands.setTimezone("America/New_York");
    expect(formatISODateString(isoDate)).toBe("15 jun. 2024");

    await commands.setTimezone("Asia/Tokyo");
    expect(formatISODateString(isoDate)).toBe("15 jun. 2024");

    await commands.setTimezone("UTC");
    expect(formatISODateString(isoDate)).toBe("15 jun. 2024");

    await commands.setTimezone("Pacific/Auckland");
    expect(formatISODateString(isoDate)).toBe("15 jun. 2024");
  });

  it("returns null for an invalid date string", () => {
    expect(formatISODateString("invalid-date")).toBeNull();
  });

  it("returns null for a date string with wrong format", () => {
    expect(formatISODateString("15-06-2024")).toBeNull();
  });

  it("returns null for null, undefined and empty input", () => {
    expect(formatISODateString(null)).toBeNull();
    expect(formatISODateString(undefined)).toBeNull();
    expect(formatISODateString("")).toBeNull();
  });
});

describe("getDealDurationDays", () => {
  it("counts an inclusive planned project duration", () => {
    expect(getDealDurationDays("2026-07-01", "2026-07-31")).toBe(31);
    expect(getDealDurationDays("2026-07-14", "2026-07-14")).toBe(1);
  });

  it("uses today for an active deal without an end date", () => {
    expect(
      getDealDurationDays("2026-07-10", null, new Date(2026, 6, 14, 18, 0)),
    ).toBe(5);
  });

  it("returns null for invalid or reversed dates", () => {
    expect(getDealDurationDays(null, "2026-07-31")).toBeNull();
    expect(getDealDurationDays("2026-08-01", "2026-07-31")).toBeNull();
  });
});

describe("isBeforeToday", () => {
  // A fixed "now" late in the day: with the old UTC-midnight comparison a
  // deal closing today would incorrectly count as past for most of the day.
  const now = new Date(2026, 5, 15, 18, 30); // 15 June 2026, 18:30 local

  it("returns true for a day before today", () => {
    expect(isBeforeToday("2026-06-14", now)).toBe(true);
    expect(isBeforeToday("2025-12-31", now)).toBe(true);
  });

  it("returns false for today, even late in the day", () => {
    expect(isBeforeToday("2026-06-15", now)).toBe(false);
  });

  it("returns false for a day after today", () => {
    expect(isBeforeToday("2026-06-16", now)).toBe(false);
  });

  it("returns false for missing or malformed dates", () => {
    expect(isBeforeToday(null, now)).toBe(false);
    expect(isBeforeToday(undefined, now)).toBe(false);
    expect(isBeforeToday("", now)).toBe(false);
    expect(isBeforeToday("15-06-2026", now)).toBe(false);
  });
});

describe("buildDealInboundEmail", () => {
  it("builds the inbound address for a numeric deal id", () => {
    expect(buildDealInboundEmail(42, "abc123@inbound.example.com")).toBe(
      "deal-42@inbound.example.com",
    );
  });

  it("builds the inbound address for a string deal id", () => {
    expect(buildDealInboundEmail("42", "abc123@inbound.example.com")).toBe(
      "deal-42@inbound.example.com",
    );
  });

  it("returns null when inboundEmail is missing", () => {
    expect(buildDealInboundEmail(42, undefined)).toBeNull();
  });

  it("returns null when inboundEmail is empty", () => {
    expect(buildDealInboundEmail(42, "")).toBeNull();
  });

  it("returns null when inboundEmail is malformed (no @)", () => {
    expect(buildDealInboundEmail(42, "not-an-email")).toBeNull();
  });

  it("returns null when inboundEmail has no domain (trailing @)", () => {
    expect(buildDealInboundEmail(42, "abc123@")).toBeNull();
  });
});
