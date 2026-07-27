/**
 * Wat Google werkelijk heeft toegekend bij de koppeling.
 *
 * De agenda-toegang was onzichtbaar: je kwam er pas achter door een afspraak te
 * proberen en dan een foutmelding te krijgen. Google zet de toegekende scopes in
 * elk tokenantwoord, dus na de eerstvolgende synchronisatie weet het CRM het.
 *
 * Onbekend is bewust een derde uitkomst en niet "nee": een koppeling van voor deze
 * wijziging heeft nog geen scopes vastgelegd, en dan is "nog geen toegang" een
 * bewering die we niet kunnen doen.
 */

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GMAIL_READ_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

export type ScopeState = "granted" | "missing" | "unknown";

const scopeList = (granted?: string | null): string[] =>
  (granted ?? "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

export const scopeState = (
  granted: string | null | undefined,
  scope: string,
): ScopeState => {
  const scopes = scopeList(granted);
  if (scopes.length === 0) return "unknown";
  return scopes.includes(scope) ? "granted" : "missing";
};

/** Eén regel over de agenda, in de taal van wat je eraan kunt doen. */
export const calendarAccessLabel = (
  granted: string | null | undefined,
): { state: ScopeState; label: string } => {
  const state = scopeState(granted, CALENDAR_SCOPE);
  if (state === "granted") {
    return {
      state,
      label: "Agenda: toegang gegeven, taken kunnen als afspraak in je agenda.",
    };
  }
  if (state === "missing") {
    return {
      state,
      label:
        "Agenda: geen toegang. Vernieuw de koppeling en geef Google toegang tot je agenda.",
    };
  }
  return {
    state,
    label:
      "Agenda: nog niet vastgesteld. Dat blijkt uit de eerstvolgende synchronisatie, binnen een kwartier.",
  };
};
