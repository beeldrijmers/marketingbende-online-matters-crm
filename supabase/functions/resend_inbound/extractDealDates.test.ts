import { describe, it, expect } from "vitest";
import { extractDealDates } from "./extractDealDates";

describe("extractDealDates", () => {
  it("reads both a delivery and a start date with named months", () => {
    expect(
      extractDealDates(
        "oplevering op 15 september 2026 en aanvang 1 augustus 2026",
      ),
    ).toEqual({ startDate: "2026-08-01", deliveryDate: "2026-09-15" });
  });

  it("reads a numeric dd-mm-yyyy deadline", () => {
    expect(extractDealDates("deadline 20-03-2026")).toEqual({
      startDate: null,
      deliveryDate: "2026-03-20",
    });
  });

  it("returns both null when there are no dates", () => {
    expect(
      extractDealDates("Graag ontvang ik een offerte voor SEO-werk."),
    ).toEqual({ startDate: null, deliveryDate: null });
  });

  it("returns both null for an empty string", () => {
    expect(extractDealDates("")).toEqual({
      startDate: null,
      deliveryDate: null,
    });
  });

  it("ignores an invalid month name", () => {
    expect(extractDealDates("aanvang 15 foo 2026")).toEqual({
      startDate: null,
      deliveryDate: null,
    });
  });

  it("ignores an out-of-range numeric month", () => {
    expect(extractDealDates("deadline 20-13-2026")).toEqual({
      startDate: null,
      deliveryDate: null,
    });
  });

  it("accepts slash and dot numeric separators", () => {
    expect(extractDealDates("start 01/09/2026")).toEqual({
      startDate: "2026-09-01",
      deliveryDate: null,
    });
    expect(extractDealDates("start 01.09.2026")).toEqual({
      startDate: "2026-09-01",
      deliveryDate: null,
    });
  });

  it("accepts month abbreviations and zero-pads the day", () => {
    expect(extractDealDates("aanvang 1 aug 2026")).toEqual({
      startDate: "2026-08-01",
      deliveryDate: null,
    });
    expect(extractDealDates("opleverdatum 3 dec 2026")).toEqual({
      startDate: null,
      deliveryDate: "2026-12-03",
    });
    expect(extractDealDates("deadline 5 mrt 2026")).toEqual({
      startDate: null,
      deliveryDate: "2026-03-05",
    });
  });

  it("matches the 'startdatum' and 'opleverdatum' label variants", () => {
    expect(
      extractDealDates("Startdatum: 20/03/2026, opleverdatum: 30-06-2026"),
    ).toEqual({ startDate: "2026-03-20", deliveryDate: "2026-06-30" });
  });

  it("ignores a date that is too far after the label", () => {
    const farText = `aanvang${" ".repeat(60)}20-03-2026`;
    expect(extractDealDates(farText)).toEqual({
      startDate: null,
      deliveryDate: null,
    });
  });

  it("does not match a label embedded inside another word", () => {
    // "herstart" contains "start" but is not a standalone label.
    expect(extractDealDates("de herstart 20-03-2026 is gepland")).toEqual({
      startDate: null,
      deliveryDate: null,
    });
  });

  it("picks the nearest date after a later label occurrence", () => {
    // The first "start" has no date nearby; the second one does.
    expect(
      extractDealDates(
        "we willen graag starten. definitieve startdatum is 20-03-2026",
      ),
    ).toEqual({ startDate: "2026-03-20", deliveryDate: null });
  });
});
