import { describe, expect, it } from "vitest";

import {
  CALENDAR_SCOPE,
  calendarAccessLabel,
  GMAIL_READ_SCOPE,
  scopeState,
} from "./googleScopes";

const beide = `openid email ${GMAIL_READ_SCOPE} ${CALENDAR_SCOPE}`;

describe("scopeState", () => {
  it("herkent een toegekende scope", () => {
    expect(scopeState(beide, CALENDAR_SCOPE)).toBe("granted");
    expect(scopeState(beide, GMAIL_READ_SCOPE)).toBe("granted");
  });

  it("herkent een ontbrekende scope als de rest er wel is", () => {
    // Dit is de koppeling van voor de agenda: Gmail toegekend, agenda niet.
    expect(scopeState(`openid email ${GMAIL_READ_SCOPE}`, CALENDAR_SCOPE)).toBe(
      "missing",
    );
  });

  it("zegt onbekend als er niets is vastgelegd", () => {
    // Niet "nee": een koppeling van voor deze wijziging heeft nog geen scopes,
    // en dan is "geen toegang" een bewering die we niet kunnen doen.
    expect(scopeState(null, CALENDAR_SCOPE)).toBe("unknown");
    expect(scopeState("", CALENDAR_SCOPE)).toBe("unknown");
    expect(scopeState("   ", CALENDAR_SCOPE)).toBe("unknown");
  });

  it("leest ook een komma-gescheiden lijst", () => {
    expect(scopeState(`openid,${CALENDAR_SCOPE}`, CALENDAR_SCOPE)).toBe(
      "granted",
    );
  });
});

describe("calendarAccessLabel", () => {
  it("zegt per geval wat je eraan kunt doen", () => {
    expect(calendarAccessLabel(beide)).toMatchObject({ state: "granted" });
    expect(calendarAccessLabel(`openid ${GMAIL_READ_SCOPE}`).label).toMatch(
      /Vernieuw de koppeling/,
    );
    expect(calendarAccessLabel(null).label).toMatch(
      /eerstvolgende synchronisatie/,
    );
  });
});
