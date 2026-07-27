import { describe, expect, it } from "vitest";

import { monthlySourceLabel } from "./monthlySourceLabel";

const basis = {
  hasStatus: false,
  bothMonthsMeasured: false,
  hasUsableMetrics: false,
  failed: false,
};

describe("monthlySourceLabel", () => {
  it("zegt niet langer 'niet gekoppeld' als de bron er wel hangt", () => {
    // Dit is het geval dat de verwarring gaf: de property hing aan de opdracht,
    // maar was niet bevestigd, dus haalde de generator geen cijfers op en zei de
    // chip "Niet gekoppeld".
    expect(
      monthlySourceLabel({
        ...basis,
        link: { configured: true, verified: false },
      }),
    ).toEqual({ ok: false, label: "Gekoppeld, nog niet bevestigd" });
  });

  it("zegt wel 'niet gekoppeld' als er echt niets hangt", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        link: { configured: false, verified: false },
      }),
    ).toEqual({ ok: false, label: "Niet gekoppeld" });
    // Zonder bekende koppelstatus blijft het oude antwoord staan.
    expect(monthlySourceLabel(basis)).toEqual({
      ok: false,
      label: "Niet gekoppeld",
    });
  });

  it("onderscheidt bevestigd zonder cijfers van niet bevestigd", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        link: { configured: true, verified: true },
      }),
    ).toEqual({ ok: false, label: "Gekoppeld, geen cijfers in deze maand" });
  });

  it("laat gemeten maanden en fouten voorgaan op de koppelstatus", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        bothMonthsMeasured: true,
        hasUsableMetrics: true,
        link: { configured: true, verified: false },
      }),
    ).toEqual({ ok: true, label: "Beide maanden gemeten" });

    expect(
      monthlySourceLabel({
        ...basis,
        bothMonthsMeasured: true,
        hasUsableMetrics: false,
        link: { configured: true, verified: true },
      }),
    ).toEqual({ ok: false, label: "Geen bruikbare kerncijfers" });

    expect(
      monthlySourceLabel({
        ...basis,
        failed: true,
        link: { configured: true, verified: true },
      }),
    ).toEqual({ ok: false, label: "Tijdelijk niet beschikbaar" });
  });

  it("houdt 'onvolledig' voor een half gemeten bevestigde bron", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        hasStatus: true,
        link: { configured: true, verified: true },
      }),
    ).toEqual({ ok: false, label: "Onvolledig" });
  });
});
