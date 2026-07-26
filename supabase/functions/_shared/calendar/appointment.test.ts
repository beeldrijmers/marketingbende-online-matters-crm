import { describe, expect, it } from "vitest";

import {
  appointmentDescription,
  appointmentTitle,
  AppointmentInputError,
  DEFAULT_DURATION_MINUTES,
  resolveWindow,
} from "./appointment";

describe("resolveWindow", () => {
  it("derives an hour when nobody sized the meeting", () => {
    const window = resolveWindow({ startsAt: "2026-07-30T09:00:00.000Z" });

    expect(window).toEqual({
      startsAt: "2026-07-30T09:00:00.000Z",
      endsAt: "2026-07-30T10:00:00.000Z",
    });
    expect(DEFAULT_DURATION_MINUTES).toBe(60);
  });

  it("accepts a duration in minutes", () => {
    expect(
      resolveWindow({
        startsAt: "2026-07-30T09:00:00.000Z",
        durationMinutes: 30,
      }),
    ).toEqual({
      startsAt: "2026-07-30T09:00:00.000Z",
      endsAt: "2026-07-30T09:30:00.000Z",
    });
  });

  it("accepts an explicit end", () => {
    expect(
      resolveWindow({
        startsAt: "2026-07-30T09:00:00.000Z",
        endsAt: "2026-07-30T11:15:00.000Z",
      }),
    ).toEqual({
      startsAt: "2026-07-30T09:00:00.000Z",
      endsAt: "2026-07-30T11:15:00.000Z",
    });
  });

  it("refuses a range that ends before it starts", () => {
    // Google accepts this and then shows an event that ends before it begins.
    expect(() =>
      resolveWindow({
        startsAt: "2026-07-30T11:00:00.000Z",
        endsAt: "2026-07-30T09:00:00.000Z",
      }),
    ).toThrow(AppointmentInputError);
    expect(() =>
      resolveWindow({
        startsAt: "2026-07-30T09:00:00.000Z",
        endsAt: "2026-07-30T09:00:00.000Z",
      }),
    ).toThrow(/na de starttijd/);
  });

  it("refuses nonsense instead of guessing", () => {
    expect(() => resolveWindow({ startsAt: "" })).toThrow(/ontbreekt/);
    expect(() => resolveWindow({ startsAt: "donderdag" })).toThrow(
      /geldig tijdstip/,
    );
    expect(() =>
      resolveWindow({
        startsAt: "2026-07-30T09:00:00.000Z",
        durationMinutes: -5,
      }),
    ).toThrow(/minuten/);
    expect(() =>
      resolveWindow({
        startsAt: "2026-07-30T09:00:00.000Z",
        durationMinutes: 60 * 24,
      }),
    ).toThrow(/werkdag/);
  });
});

describe("appointmentTitle", () => {
  it("puts the client first in our own calendar", () => {
    expect(
      appointmentTitle({
        companyName: "ASP Noard",
        taskText: "staging doorlopen",
        withGuest: false,
      }),
    ).toBe("ASP Noard - staging doorlopen");
  });

  it("stays neutral once a guest is invited", () => {
    // The title travels to the guest, so our shorthand stays home.
    expect(
      appointmentTitle({
        companyName: "ASP Noard",
        taskText: "beoordelen of dit bij ons past",
        withGuest: true,
      }),
    ).toBe("Overleg ASP Noard");
  });

  it("still produces a title without a client or without a task", () => {
    expect(
      appointmentTitle({
        companyName: null,
        taskText: "Bellen",
        withGuest: false,
      }),
    ).toBe("Bellen");
    expect(
      appointmentTitle({
        companyName: "ASP Noard",
        taskText: "  ",
        withGuest: false,
      }),
    ).toBe("ASP Noard");
    expect(
      appointmentTitle({ companyName: null, taskText: "", withGuest: false }),
    ).toBe("Afspraak");
  });
});

describe("appointmentDescription", () => {
  it("links the calendar entry back to the assignment", () => {
    expect(
      appointmentDescription({
        dealName: "Staging klaar",
        dealUrl: "https://crm.marketingbende.nl/#/deals/64/show",
      }),
    ).toBe(
      "Opdracht: Staging klaar\nIn Kompas: https://crm.marketingbende.nl/#/deals/64/show",
    );
  });

  it("stays empty when there is nothing to point at", () => {
    expect(appointmentDescription({})).toBeUndefined();
  });
});
