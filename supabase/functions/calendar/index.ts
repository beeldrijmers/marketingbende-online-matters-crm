import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  appointmentDescription,
  AppointmentInputError,
  appointmentTitle,
  resolveWindow,
} from "../_shared/calendar/appointment.ts";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from "../_shared/calendar/googleCalendar.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { GoogleApiError } from "../_shared/gmail/client.ts";
import {
  getGoogleAccessToken,
  GoogleConnectionMissing,
} from "../_shared/gmail/connectionToken.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

/**
 * Putting a CRM task in the owner's Google Calendar, and keeping it there.
 *
 * The browser asks; this function decides. It runs as service_role because the
 * appointment columns on tasks are not client-writable: a link to a calendar
 * event has to mean that the event exists, so only the code that talked to
 * Google may write it.
 *
 * Two boundaries worth naming:
 *   - the appointment lands in the calendar of the CALLER, resolved from their
 *     own Google connection — never in a colleague's;
 *   - a client is only ever invited when the request explicitly asks for it, and
 *     then Google sends them a mail. Nothing here reaches a client by default.
 */
const CRM_BASE_URL =
  Deno.env.get("CRM_BASE_URL") ?? "https://crm.marketingbende.nl";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status,
  });

type TaskRow = {
  id: number;
  text: string | null;
  deal_id: number | null;
  contact_id: number | null;
  sales_id: number | null;
  calendar_event_id: string | null;
};

/**
 * The task, but only if this user may act on it: a task on a deal follows the
 * deal's assignees, exactly as the board's own row-level policy does.
 */
const loadTaskForUser = async (
  taskId: unknown,
  salesId: number,
  isAdmin: boolean,
): Promise<TaskRow | null> => {
  const id = Number(taskId);
  if (!Number.isFinite(id)) return null;

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, text, deal_id, contact_id, sales_id, calendar_event_id")
    .eq("id", id)
    .maybeSingle();
  if (!task) return null;

  if (isAdmin) return task as TaskRow;
  if (task.deal_id == null) {
    // A task without a deal belongs to whoever it is assigned to.
    return task.sales_id === salesId ? (task as TaskRow) : null;
  }
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("id", task.deal_id)
    .contains("assignee_ids", [salesId])
    .maybeSingle();
  return deal ? (task as TaskRow) : null;
};

const loadContext = async (task: TaskRow) => {
  if (task.deal_id == null) return { companyName: null, dealName: null };
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("name, company_id")
    .eq("id", task.deal_id)
    .maybeSingle();
  if (!deal) return { companyName: null, dealName: null };
  const { data: company } = deal.company_id
    ? await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", deal.company_id)
        .maybeSingle()
    : { data: null };
  return {
    companyName: (company?.name as string | undefined) ?? null,
    dealName: (deal.name as string | undefined) ?? null,
  };
};

const googleError = (error: unknown): Response => {
  if (error instanceof GoogleConnectionMissing) {
    return createErrorResponse(
      409,
      "Je Google-agenda is nog niet gekoppeld. Koppel Google opnieuw in je instellingen.",
    );
  }
  if (error instanceof GoogleApiError) {
    // 403 with an existing connection means the older Gmail-only consent: the
    // calendar scope simply was not granted yet.
    if (error.status === 401 || error.status === 403) {
      return createErrorResponse(
        409,
        "Kompas mag nog niet in je agenda schrijven. Koppel Google opnieuw en geef toegang tot je agenda.",
      );
    }
    return createErrorResponse(502, "Google Agenda gaf een fout terug.");
  }
  if (error instanceof AppointmentInputError) {
    return createErrorResponse(400, error.message);
  }
  console.error("calendar function failed:", error);
  return createErrorResponse(500, "De afspraak kon niet worden verwerkt.");
};

const handleUpsert = async (
  req: Request,
  salesId: number,
  isAdmin: boolean,
): Promise<Response> => {
  const payload = await req.json().catch(() => null);
  if (!payload) return createErrorResponse(400, "Ongeldige aanvraag.");

  const task = await loadTaskForUser(payload.taskId, salesId, isAdmin);
  if (!task) return createErrorResponse(404, "Taak niet gevonden.");

  try {
    const window = resolveWindow(payload);
    const attendeeEmail =
      payload.inviteEmail && payload.inviteClient === true
        ? String(payload.inviteEmail)
        : undefined;
    const { companyName, dealName } = await loadContext(task);
    const appointment = {
      ...window,
      attendeeEmail,
      description: appointmentDescription({
        dealName,
        dealUrl: task.deal_id
          ? `${CRM_BASE_URL}/#/deals/${task.deal_id}/show`
          : null,
      }),
      summary: appointmentTitle({
        companyName,
        taskText: task.text ?? "",
        withGuest: Boolean(attendeeEmail),
      }),
    };

    const accessToken = await getGoogleAccessToken(salesId);
    const event = task.calendar_event_id
      ? ((await updateAppointment(
          accessToken,
          task.calendar_event_id,
          appointment,
        )) ?? (await createAppointment(accessToken, appointment)))
      : await createAppointment(accessToken, appointment);

    const { error } = await supabaseAdmin
      .from("tasks")
      .update({
        calendar_event_id: event.id,
        calendar_html_link: event.htmlLink,
        calendar_synced_at: new Date().toISOString(),
        ends_at: event.end || window.endsAt,
        starts_at: event.start || window.startsAt,
        // A dated task keeps its own due date in step with the appointment, so
        // the board and the calendar cannot disagree about the day.
        due_date: event.start || window.startsAt,
      })
      .eq("id", task.id);
    if (error) throw new Error(error.message);

    return jsonResponse({
      data: {
        eventId: event.id,
        htmlLink: event.htmlLink,
        startsAt: event.start || window.startsAt,
        endsAt: event.end || window.endsAt,
        invited: Boolean(attendeeEmail),
      },
    });
  } catch (error) {
    return googleError(error);
  }
};

const handleRemove = async (
  req: Request,
  salesId: number,
  isAdmin: boolean,
): Promise<Response> => {
  const payload = await req.json().catch(() => null);
  const task = await loadTaskForUser(payload?.taskId, salesId, isAdmin);
  if (!task) return createErrorResponse(404, "Taak niet gevonden.");
  if (!task.calendar_event_id) {
    return jsonResponse({ data: { removed: false } });
  }

  try {
    const accessToken = await getGoogleAccessToken(salesId);
    await deleteAppointment(accessToken, task.calendar_event_id);
  } catch (error) {
    // A calendar that already lost the event should not keep the CRM pointing at
    // it; anything else is a real failure the user has to hear about.
    if (!(error instanceof GoogleApiError) || error.status < 400) {
      return googleError(error);
    }
    if (error.status !== 404 && error.status !== 410) return googleError(error);
  }

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      calendar_event_id: null,
      calendar_html_link: null,
      calendar_synced_at: null,
      ends_at: null,
      starts_at: null,
    })
    .eq("id", task.id);
  if (error) {
    console.error("Could not clear appointment:", error.message);
    return createErrorResponse(500, "De afspraak kon niet worden losgemaakt.");
  }
  return jsonResponse({ data: { removed: true } });
};

Deno.serve((req) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, async (req, user) => {
        const sale = await getUserSale(user!);
        if (!sale) return createErrorResponse(401, "Unauthorized");
        const isAdmin = sale.administrator === true;

        if (req.method === "POST") return handleUpsert(req, sale.id, isAdmin);
        if (req.method === "DELETE") return handleRemove(req, sale.id, isAdmin);
        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
