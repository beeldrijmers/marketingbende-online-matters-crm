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
    ).toEqual({
      ok: false,
      tone: "warn",
      label: "Gekoppeld, nog niet bevestigd",
    });
  });

  it("zegt wel 'niet gekoppeld' als er echt niets hangt", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        link: { configured: false, verified: false },
      }),
    ).toEqual({ ok: false, tone: "idle", label: "Niet gekoppeld" });
    // Zonder bekende koppelstatus blijft het oude antwoord staan.
    expect(monthlySourceLabel(basis)).toEqual({
      ok: false,
      tone: "idle",
      label: "Niet gekoppeld",
    });
  });

  it("onderscheidt bevestigd zonder cijfers van niet bevestigd", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        link: { configured: true, verified: true },
      }),
    ).toEqual({
      ok: false,
      tone: "warn",
      label: "Gekoppeld, geen cijfers in deze maand",
    });
  });

  it("laat gemeten maanden en fouten voorgaan op de koppelstatus", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        bothMonthsMeasured: true,
        hasUsableMetrics: true,
        link: { configured: true, verified: false },
      }),
    ).toEqual({ ok: true, tone: "ok", label: "Beide maanden gemeten" });

    expect(
      monthlySourceLabel({
        ...basis,
        bothMonthsMeasured: true,
        hasUsableMetrics: false,
        link: { configured: true, verified: true },
      }),
    ).toEqual({
      ok: false,
      tone: "warn",
      label: "Geen bruikbare kerncijfers",
    });

    expect(
      monthlySourceLabel({
        ...basis,
        failed: true,
        link: { configured: true, verified: true },
      }),
    ).toEqual({
      ok: false,
      tone: "warn",
      label: "Tijdelijk niet beschikbaar",
    });
  });

  it("markeert 'niet gekoppeld' als rustig, niet als waarschuwing", () => {
    // Een bron die nooit is aangesloten hoorde oranje te schreeuwen naast de
    // bronnen die wel gemeten zijn. Dat is geen aandachtspunt maar afwezigheid.
    expect(monthlySourceLabel(basis).tone).toBe("idle");
    expect(monthlySourceLabel({ ...basis, failed: true }).tone).toBe("warn");
  });

  it("houdt 'onvolledig' voor een half gemeten bevestigde bron", () => {
    expect(
      monthlySourceLabel({
        ...basis,
        hasStatus: true,
        link: { configured: true, verified: true },
      }),
    ).toEqual({ ok: false, tone: "warn", label: "Onvolledig" });
  });
});
