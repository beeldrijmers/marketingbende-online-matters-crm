/**
 * Turning a CRM task into an appointment, decided in pure functions so the rules
 * are testable without a Google account.
 */

/** A meeting nobody sized is an hour; that is what a calendar assumes too. */
export const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 60 * 12;

export class AppointmentInputError extends Error {}

const parse = (value: unknown, field: string): Date => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppointmentInputError(`${field} ontbreekt.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppointmentInputError(`${field} is geen geldig tijdstip.`);
  }
  return date;
};

/**
 * The window an appointment occupies. An end may be given or derived from a
 * duration; either way the result is a real range, because Google accepts an
 * inverted one and then shows an event that ends before it starts.
 */
export const resolveWindow = ({
  startsAt,
  endsAt,
  durationMinutes,
}: {
  startsAt: unknown;
  endsAt?: unknown;
  durationMinutes?: unknown;
}): { startsAt: string; endsAt: string } => {
  const start = parse(startsAt, "Starttijd");

  if (endsAt != null && endsAt !== "") {
    const end = parse(endsAt, "Eindtijd");
    if (end.getTime() <= start.getTime()) {
      throw new AppointmentInputError(
        "De eindtijd moet na de starttijd liggen.",
      );
    }
    return { startsAt: start.toISOString(), endsAt: end.toISOString() };
  }

  const minutes =
    durationMinutes == null || durationMinutes === ""
      ? DEFAULT_DURATION_MINUTES
      : Number(durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new AppointmentInputError("De duur moet een aantal minuten zijn.");
  }
  if (minutes > MAX_DURATION_MINUTES) {
    throw new AppointmentInputError("De duur is langer dan een werkdag.");
  }
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
  };
};

/**
 * What the appointment is called in the calendar.
 *
 * Our own calendar, so our own words: the client's name first, because that is
 * what you scan a week for, then what it is about. When a guest is invited the
 * title travels to them, so then it stays neutral and never carries our
 * shorthand.
 */
export const appointmentTitle = ({
  companyName,
  taskText,
  withGuest,
}: {
  companyName?: string | null;
  taskText: string;
  withGuest: boolean;
}): string => {
  const subject = taskText.trim().replace(/\s+/g, " ");
  const client = companyName?.trim();
  if (withGuest) {
    return client ? `Overleg ${client}` : "Overleg";
  }
  if (!client) return subject || "Afspraak";
  return subject ? `${client} - ${subject}` : client;
};

/** A line back to the assignment, so the calendar entry is not a dead end. */
export const appointmentDescription = ({
  dealName,
  dealUrl,
}: {
  dealName?: string | null;
  dealUrl?: string | null;
}): string | undefined => {
  const parts = [
    dealName ? `Opdracht: ${dealName}` : null,
    dealUrl ? `In Kompas: ${dealUrl}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : undefined;
};
