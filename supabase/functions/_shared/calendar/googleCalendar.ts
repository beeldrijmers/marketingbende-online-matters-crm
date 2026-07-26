import { GoogleApiError } from "../gmail/client.ts";

const CALENDAR_API =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * The Calendar API, narrowed to what the CRM needs: put an appointment in the
 * owner's own calendar, move it, remove it.
 *
 * Never reads the calendar. An appointment the CRM did not create is none of its
 * business, and a private agenda is not a data source.
 */

export interface CalendarEvent {
  id: string;
  htmlLink: string;
  start: string;
  end: string;
}

export interface AppointmentInput {
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  /**
   * Adding a guest makes Google send them an invitation, so this is only ever
   * set when someone explicitly asked for it — the CRM does not write to a
   * client out of its own accord.
   */
  attendeeEmail?: string;
}

const asEvent = (payload: {
  id?: string;
  htmlLink?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}): CalendarEvent => {
  if (!payload.id) throw new Error("Google returned an event without an id");
  return {
    id: payload.id,
    htmlLink: payload.htmlLink ?? "",
    start: payload.start?.dateTime ?? "",
    end: payload.end?.dateTime ?? "",
  };
};

const body = (appointment: AppointmentInput) => ({
  summary: appointment.summary,
  ...(appointment.description ? { description: appointment.description } : {}),
  start: { dateTime: appointment.startsAt },
  end: { dateTime: appointment.endsAt },
  ...(appointment.attendeeEmail
    ? { attendees: [{ email: appointment.attendeeEmail }] }
    : {}),
});

const call = async (
  url: string,
  accessToken: string,
  init: RequestInit,
): Promise<Response> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    // Google's body can name other events in the calendar, so it stays out of
    // the error that travels back to the browser.
    throw new GoogleApiError(
      response.status,
      `Google Calendar API returned HTTP ${response.status}`,
    );
  }
  return response;
};

/**
 * `sendUpdates` is explicit in every call: the default ("legacy") mails guests
 * in some cases and not in others, and "who gets a mail" is not something to
 * leave to a default.
 */
const sendUpdates = (appointment: AppointmentInput) =>
  appointment.attendeeEmail ? "all" : "none";

export const createAppointment = async (
  accessToken: string,
  appointment: AppointmentInput,
): Promise<CalendarEvent> => {
  const response = await call(
    `${CALENDAR_API}?sendUpdates=${sendUpdates(appointment)}`,
    accessToken,
    { method: "POST", body: JSON.stringify(body(appointment)) },
  );
  return asEvent(await response.json());
};

export const updateAppointment = async (
  accessToken: string,
  eventId: string,
  appointment: AppointmentInput,
): Promise<CalendarEvent | null> => {
  const response = await call(
    `${CALENDAR_API}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates(appointment)}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(body(appointment)) },
  );
  // Someone deleted the event in the calendar itself; the CRM has to be able to
  // say so instead of failing.
  if (response.status === 404 || response.status === 410) return null;
  return asEvent(await response.json());
};

export const deleteAppointment = async (
  accessToken: string,
  eventId: string,
): Promise<void> => {
  await call(
    `${CALENDAR_API}/${encodeURIComponent(eventId)}?sendUpdates=none`,
    accessToken,
    { method: "DELETE" },
  );
};
