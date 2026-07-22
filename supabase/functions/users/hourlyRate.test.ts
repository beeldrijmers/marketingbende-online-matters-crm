import { describe, expect, it } from "vitest";

import { normalizeHourlyRate } from "./hourlyRate";

describe("normalizeHourlyRate", () => {
  it("keeps an omitted rate omitted", () => {
    expect(normalizeHourlyRate(undefined)).toBeUndefined();
  });

  it("uses null for an intentionally empty rate", () => {
    expect(normalizeHourlyRate(null)).toBeNull();
    expect(normalizeHourlyRate("")).toBeNull();
  });

  it("rounds a valid rate to cents", () => {
    expect(normalizeHourlyRate(75.126)).toBe(75.13);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "75"])(
    "rejects invalid input %s",
    (value) => {
      expect(() => normalizeHourlyRate(value)).toThrow(
        "Het uurtarief moet nul of hoger zijn, of leeg blijven.",
      );
    },
  );
});
