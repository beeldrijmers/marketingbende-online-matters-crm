import { describe, it, expect } from "vitest";
import { trelloCardCreatedAt } from "./trelloCardDate";

describe("trelloCardCreatedAt", () => {
  const now = Date.UTC(2026, 6, 5); // 5 July 2026, stable clock for the tests

  it("decodes the creation date embedded in a Trello ObjectId", () => {
    // Build a real 24-char ObjectId whose timestamp is a known date, then
    // check it round-trips back to that exact instant.
    const seconds = Math.floor(Date.UTC(2025, 0, 15, 12, 0, 0) / 1000);
    const id = seconds.toString(16).padStart(8, "0") + "abcdef0123456789";
    expect(trelloCardCreatedAt(id, now)).toBe(
      new Date(seconds * 1000).toISOString(),
    );
  });

  it("returns null for a non-hex / too-short id", () => {
    expect(trelloCardCreatedAt("not-an-object-id", now)).toBeNull();
    expect(trelloCardCreatedAt("1234", now)).toBeNull();
  });

  it("rejects a timestamp in the future", () => {
    // 0xffffffff = 4294967295s = year 2106, well after `now`
    expect(trelloCardCreatedAt("ffffffff0000000000000000", now)).toBeNull();
  });

  it("rejects an implausibly old timestamp (before Trello existed)", () => {
    // 0x00000001 = 1970, long before 2010
    expect(trelloCardCreatedAt("00000001aaaaaaaaaaaaaaaa", now)).toBeNull();
  });
});
