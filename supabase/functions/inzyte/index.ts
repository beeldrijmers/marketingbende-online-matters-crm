import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  buildRemoteRequest,
  INZYTE_ACTIONS,
  type InzyteAction,
  normalizeDateRange,
  TRACKED_ACTIONS,
} from "./actions.ts";
import {
  buildMonthlyHeadlineMetrics,
  monthlyReportPeriod,
  type MonthlyHeadlineMetric,
  type MonthlyReportPeriod,
} from "./monthlyReport.ts";

type JsonObject = Record<string, unknown>;

type InzyteLink = {
  id: number;
  deal_id: number;
  company_id: number | null;
  website_url: string | null;
  inzyte_user_id: string;
  ga4_connection_id: string | null;
  ga4_connection_name: string | null;
  ga4_property_id: string | null;
  ga4_property_name: string | null;
  gsc_site_url: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_location_name: string | null;
  ads_customer_id: string | null;
  ads_account_name: string | null;
  ads_login_customer_id: string | null;
  created_by: number | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESULT_SNAPSHOT_BYTES = 600_000;
const INZYTE_TIMEOUT_MS = 175_000;
const DUTCH_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

class InzyteUserError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "InzyteUserError";
  }
}

const userError = (message: string, status = 400): InzyteUserError =>
  new InzyteUserError(message, status);

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const requiredPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const optionalText = (value: unknown, maxLength = 500): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const optionalUuid = (value: unknown): string | null => {
  const text = optionalText(value, 64);
  return text && UUID_RE.test(text) ? text : null;
};

const optionalWebsite = (value: unknown): string | null => {
  const text = optionalText(value, 2_000);
  if (!text) return null;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(text) ? text : `https://${text}`,
    );
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
};

const getInzyteConfig = () => {
  const secret = Deno.env.get("INZYTE_AGENCY_SECRET");
  const baseUrl = (
    Deno.env.get("INZYTE_AGENCY_URL") || "https://inzyte.io/api/v1/agency"
  ).replace(/\/+$/, "");
  if (!secret) throw new Error("INZYTE_AGENCY_SECRET is not configured");
  return { secret, baseUrl };
};

const callInzyte = async (
  path: string,
  options: {
    userId?: string;
    method?: "GET" | "POST";
    body?: JsonObject;
  } = {},
): Promise<unknown> => {
  const { secret, baseUrl } = getInzyteConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INZYTE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/${path.replace(/^\/+/, "")}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "nl",
        "X-Inzyte-Agency-Secret": secret,
        ...(options.userId
          ? { "X-Inzyte-Agency-User-Id": options.userId }
          : {}),
      },
      body:
        (options.method || "GET") === "POST"
          ? JSON.stringify(options.body || {})
          : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorPayload: unknown = {};
      try {
        errorPayload = responseText ? JSON.parse(responseText) : {};
      } catch {
        errorPayload = {};
      }
      const remoteMessage = isRecord(errorPayload)
        ? optionalText(errorPayload.message || errorPayload.error, 240)
        : null;
      throw new Error(remoteMessage || `INZYTE_HTTP_${response.status}`);
    }

    const responseText = await response.text();
    let payload: unknown = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const getDealContext = async (dealId: number, sale: JsonObject) => {
  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .select(
      "id, name, company_id, assignee_ids, sales_id, description, category, created_at, revenue_period, moneybird_estimate_id, moneybird_estimate_live_state, moneybird_estimate_checked_at, moneybird_invoice_id, moneybird_invoice_live_state, moneybird_invoice_checked_at, companies(id, name, website)",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (error || !deal) return { error: "not_found" as const };

  const saleId = Number(sale.id);
  const assignees = Array.isArray(deal.assignee_ids)
    ? deal.assignee_ids.map(Number)
    : [];
  const isAdmin = sale.administrator === true;
  if (!isAdmin && !assignees.includes(saleId)) {
    return { error: "forbidden" as const };
  }

  const company = Array.isArray(deal.companies)
    ? deal.companies[0] || null
    : deal.companies || null;
  return { deal: { ...deal, companies: company } };
};

const getLink = async (dealId: number): Promise<InzyteLink | null> => {
  const { data, error } = await supabaseAdmin
    .from("inzyte_links")
    .select("*")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (error) throw error;
  return data as InzyteLink | null;
};

const summarizeResult = (result: unknown): JsonObject => {
  if (!isRecord(result)) {
    return { kind: Array.isArray(result) ? "array" : typeof result };
  }
  const keys = Object.keys(result).slice(0, 30);
  const counts = Object.fromEntries(
    Object.entries(result)
      .filter(([, value]) => Array.isArray(value))
      .slice(0, 20)
      .map(([key, value]) => [key, (value as unknown[]).length]),
  );
  return { keys, counts };
};

const boundedSnapshot = (result: unknown): unknown => {
  const serialized = JSON.stringify(result);
  if (
    new TextEncoder().encode(serialized).byteLength <= MAX_RESULT_SNAPSHOT_BYTES
  ) {
    return result;
  }
  return {
    truncated: true,
    reason: "Het volledige resultaat was te groot voor de historie.",
    summary: summarizeResult(result),
  };
};

const safeRunError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("abort")) {
    return "Inzyte had te lang nodig om te antwoorden.";
  }
  if (message.includes("not connected") || message.includes("not_connected")) {
    return "Deze gegevensbron is nog niet gekoppeld in Inzyte.";
  }
  if (message.includes("reauth") || message.includes("expired")) {
    return "De Google-koppeling moet opnieuw worden geautoriseerd.";
  }
  return "Inzyte kon deze opdracht nu niet uitvoeren. Controleer de koppelingen en probeer opnieuw.";
};

const settledSource = async (
  path: string,
  userId: string,
  options: { method?: "GET" | "POST"; body?: JsonObject } = {},
) => {
  try {
    return {
      ok: true,
      data: await callInzyte(path, { userId, ...options }),
    };
  } catch (error) {
    return { ok: false, error: safeRunError(error) };
  }
};

const loadBootstrap = async (deal: JsonObject, link: InzyteLink | null) => {
  const [catalog, recentRunsResult, recentReportsResult, suggestedLinkResult] =
    await Promise.all([
      callInzyte("catalog"),
      supabaseAdmin
        .from("inzyte_runs")
        .select(
          "id, deal_id, inzyte_link_id, action, status, date_start, date_end, started_at, finished_at, result, summary, error",
        )
        .eq("deal_id", deal.id)
        .order("started_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("seo_monthly_reports")
        .select(
          "id, deal_id, company_id, reporting_month, current_start, current_end, previous_start, previous_end, data_through, status, title, client_summary, work_summary, next_steps, report_data, headline_metrics, current_work_count, all_time_work_count, generated_at, finalized_at, updated_at",
        )
        .eq("deal_id", deal.id)
        .order("reporting_month", { ascending: false })
        .limit(24),
      !link && deal.company_id
        ? supabaseAdmin
            .from("inzyte_links")
            .select("*")
            .eq("company_id", deal.company_id)
            .neq("deal_id", deal.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (recentRunsResult.error) throw recentRunsResult.error;
  if (recentReportsResult.error) throw recentReportsResult.error;
  const catalogWorkspaces =
    isRecord(catalog) && Array.isArray(catalog.workspaces)
      ? catalog.workspaces
      : [];
  return {
    deal: {
      id: deal.id,
      name: deal.name,
      companyId: deal.company_id,
      companyName: isRecord(deal.companies) ? deal.companies.name : null,
      companyWebsite: isRecord(deal.companies) ? deal.companies.website : null,
    },
    link,
    suggestedLink: suggestedLinkResult.data || null,
    workspaces: catalogWorkspaces,
    recentRuns: recentRunsResult.data || [],
    monthlyReports: recentReportsResult.data || [],
  };
};

const saveLink = async (
  deal: JsonObject,
  saleId: number,
  body: JsonObject,
): Promise<InzyteLink> => {
  const inzyteUserId = optionalUuid(body.inzyteUserId);
  if (!inzyteUserId) throw userError("Kies eerst een geldig Inzyte-account.");

  const catalog = await callInzyte("catalog");
  const workspaces =
    isRecord(catalog) && Array.isArray(catalog.workspaces)
      ? catalog.workspaces
      : [];
  const workspace = workspaces.find(
    (item) => isRecord(item) && item.id === inzyteUserId,
  );
  if (!workspace || !isRecord(workspace)) {
    throw userError("Dit Inzyte-account is niet beschikbaar.");
  }

  const connectionId = optionalUuid(body.ga4ConnectionId);
  if (connectionId) {
    const integrations = Array.isArray(workspace.integrations)
      ? workspace.integrations
      : [];
    const ownsConnection = integrations.some(
      (integration) =>
        isRecord(integration) &&
        integration.id === connectionId &&
        integration.provider === "google_ga4" &&
        integration.active === true,
    );
    if (!ownsConnection) {
      throw userError(
        "De gekozen GA4-koppeling hoort niet bij dit Inzyte-account.",
      );
    }
  }

  const propertyId = optionalText(body.ga4PropertyId, 40);
  if (propertyId && !/^\d+$/.test(propertyId)) {
    throw userError("Kies een geldige GA4-property.");
  }

  const now = new Date().toISOString();
  const row = {
    deal_id: Number(deal.id),
    company_id: deal.company_id ? Number(deal.company_id) : null,
    website_url: optionalWebsite(body.websiteUrl),
    inzyte_user_id: inzyteUserId,
    ga4_connection_id: connectionId,
    ga4_connection_name: optionalText(body.ga4ConnectionName),
    ga4_property_id: propertyId,
    ga4_property_name: optionalText(body.ga4PropertyName),
    gsc_site_url: optionalText(body.gscSiteUrl, 2_000),
    gbp_account_id: optionalText(body.gbpAccountId),
    gbp_location_id: optionalText(body.gbpLocationId),
    gbp_location_name: optionalText(body.gbpLocationName),
    ads_customer_id:
      optionalText(body.adsCustomerId, 40)?.replace(/-/g, "") || null,
    ads_account_name: optionalText(body.adsAccountName),
    ads_login_customer_id:
      optionalText(body.adsLoginCustomerId, 40)?.replace(/-/g, "") || null,
    created_by: saleId,
    last_verified_at: now,
    last_error: null,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("inzyte_links")
    .upsert(row, { onConflict: "deal_id" })
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Koppeling opslaan is mislukt.");
  return data as InzyteLink;
};

const loadSetupSources = async (
  userId: string,
  connectionId: string | null,
) => {
  const [connections, properties, searchConsole, businessProfile, googleAds] =
    await Promise.all([
      settledSource("auth/ga4-connections", userId),
      connectionId
        ? settledSource("ga4/list-properties", userId, {
            method: "POST",
            body: { connectionId },
          })
        : Promise.resolve({
            ok: false,
            error: "Kies eerst een GA4-koppeling.",
          }),
      settledSource("auth/sc-sites", userId),
      settledSource("auth/gbp-locations", userId),
      settledSource("auth/ads-accounts", userId),
    ]);
  return { connections, properties, searchConsole, businessProfile, googleAds };
};

const runRemoteAction = async (
  action: InzyteAction,
  dealId: number,
  saleId: number,
  link: InzyteLink,
  body: JsonObject,
) => {
  const request = buildRemoteRequest(action, link, {
    startDate: body.startDate,
    endDate: body.endDate,
    question: body.question,
    payload: body.payload,
    forceRefresh: body.forceRefresh,
  });
  if (
    request.requiresGa4 &&
    (!link.ga4_connection_id || !link.ga4_property_id)
  ) {
    throw userError(
      "Koppel eerst een GA4-account en property aan deze opdracht.",
      409,
    );
  }

  const range = normalizeDateRange(body.startDate, body.endDate);
  let runId: number | null = null;
  if (TRACKED_ACTIONS.has(action)) {
    const { data: run, error } = await supabaseAdmin
      .from("inzyte_runs")
      .insert({
        deal_id: dealId,
        inzyte_link_id: link.id,
        action,
        status: "running",
        date_start: action === "realtime" ? null : range.startDate,
        date_end: action === "realtime" ? null : range.endDate,
        requested_by: saleId,
      })
      .select("id")
      .single();
    if (!error) runId = Number(run?.id) || null;
  }

  try {
    const result = await callInzyte(request.path, {
      userId: link.inzyte_user_id,
      method: request.method,
      body: request.body,
    });
    if (runId) {
      await supabaseAdmin
        .from("inzyte_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          result: boundedSnapshot(result),
          summary: summarizeResult(result),
          error: null,
        })
        .eq("id", runId);
    }
    await supabaseAdmin
      .from("inzyte_links")
      .update({
        last_verified_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    return { result, runId };
  } catch (error) {
    const message = safeRunError(error);
    if (runId) {
      await supabaseAdmin
        .from("inzyte_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", runId);
    }
    await supabaseAdmin
      .from("inzyte_links")
      .update({
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    throw new Error(message);
  }
};

type MonthlySourceResult =
  | { status: "success"; data: unknown; runId: number | null }
  | { status: "unavailable" | "failed"; error: string };

type WorkCompletion = {
  id: number;
  task_id: number | null;
  completion_month: string;
  completed_at: string;
  task_text: string;
  task_type: string | null;
  task_source: string | null;
  completed_by: number | null;
};

const monthLabel = (isoMonth: string): string =>
  DUTCH_MONTH_YEAR_FORMATTER.format(
    new Date(`${isoMonth.slice(0, 7)}-01T00:00:00Z`),
  );

const nextIsoDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

const loadMonthlyWorkContext = async (
  dealId: number,
  period: MonthlyReportPeriod,
) => {
  const [allCompletions, currentCompletions, allNotes, currentNotes] =
    await Promise.all([
      supabaseAdmin
        .from("deal_task_completions")
        .select(
          "id, task_id, completion_month, completed_at, task_text, task_type, task_source, completed_by",
          { count: "exact" },
        )
        .eq("deal_id", dealId)
        .order("completed_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("deal_task_completions")
        .select(
          "id, task_id, completion_month, completed_at, task_text, task_type, task_source, completed_by",
          { count: "exact" },
        )
        .eq("deal_id", dealId)
        .eq("completion_month", period.reportingMonth)
        .order("completed_at", { ascending: true })
        .limit(250),
      supabaseAdmin
        .from("deal_notes")
        .select(
          "id, text, date, type, activity_source, activity_source_author, source_event_id",
          { count: "exact" },
        )
        .eq("deal_id", dealId)
        .order("date", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("deal_notes")
        .select(
          "id, text, date, type, activity_source, activity_source_author, source_event_id",
        )
        .eq("deal_id", dealId)
        .gte("date", `${period.currentStart}T00:00:00.000Z`)
        .lt("date", `${nextIsoDay(period.currentEnd)}T00:00:00.000Z`)
        .order("date", { ascending: true })
        .limit(100),
    ]);

  const error =
    allCompletions.error ||
    currentCompletions.error ||
    allNotes.error ||
    currentNotes.error;
  if (error) throw error;

  const compactActivity = (rows: JsonObject[]) =>
    rows.map((note) => ({
      ...note,
      text: optionalText(note.text, 1_500) || "Notitie zonder tekst",
    }));

  return {
    allTime: (allCompletions.data || []) as WorkCompletion[],
    allTimeCount: allCompletions.count || 0,
    current: (currentCompletions.data || []) as WorkCompletion[],
    currentCount: currentCompletions.count || 0,
    allTimeNoteCount: allNotes.count || 0,
    allTimeInternalActivity: compactActivity(allNotes.data || []),
    currentInternalActivity: compactActivity(currentNotes.data || []),
  };
};

const settleMonthlyAction = async ({
  enabled,
  action,
  dealId,
  saleId,
  link,
  startDate,
  endDate,
}: {
  enabled: boolean;
  action: "overview" | "search_console";
  dealId: number;
  saleId: number;
  link: InzyteLink;
  startDate: string;
  endDate: string;
}): Promise<MonthlySourceResult> => {
  if (!enabled) {
    return {
      status: "unavailable",
      error:
        action === "overview"
          ? "GA4 is nog niet aan deze opdracht gekoppeld."
          : "Search Console is nog niet aan deze opdracht gekoppeld.",
    };
  }
  try {
    const { result, runId } = await runRemoteAction(
      action,
      dealId,
      saleId,
      link,
      { startDate, endDate, forceRefresh: true },
    );
    return { status: "success", data: boundedSnapshot(result), runId };
  } catch (error) {
    return { status: "failed", error: safeRunError(error) };
  }
};

const formatMetric = (metric: MonthlyHeadlineMetric): string => {
  if (metric.format === "percent") {
    return `${metric.current.toLocaleString("nl-NL", {
      maximumFractionDigits: 1,
    })}%`;
  }
  return metric.current.toLocaleString("nl-NL", {
    maximumFractionDigits: metric.format === "decimal" ? 1 : 0,
  });
};

const defaultClientSummary = ({
  companyName,
  period,
  metrics,
  workCount,
}: {
  companyName: string;
  period: MonthlyReportPeriod;
  metrics: MonthlyHeadlineMetric[];
  workCount: number;
}): string => {
  const comparable = metrics.filter(
    (metric) => metric.group === "seo" && metric.changePercent !== null,
  );
  const favourable = comparable
    .filter((metric) => metric.favourable === true)
    .sort(
      (left, right) =>
        Math.abs(right.changePercent || 0) - Math.abs(left.changePercent || 0),
    )[0];
  const attention = comparable
    .filter((metric) => metric.favourable === false)
    .sort(
      (left, right) =>
        Math.abs(right.changePercent || 0) - Math.abs(left.changePercent || 0),
    )[0];
  const lines = [
    `Deze SEO-update voor ${companyName} vergelijkt ${monthLabel(
      period.reportingMonth,
    )} met ${monthLabel(period.previousStart)}.`,
    workCount > 0
      ? `In de meetmaand zijn ${workCount} werkzaamheden als afgerond vastgelegd.`
      : "In de meetmaand zijn nog geen afgeronde werkzaamheden in het CRM-logboek vastgelegd.",
  ];
  if (favourable) {
    lines.push(
      `${favourable.label} kwam uit op ${formatMetric(favourable)} (${favourable.changePercent! >= 0 ? "+" : ""}${favourable.changePercent!.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}% maand-op-maand).`,
    );
  }
  if (attention) {
    lines.push(
      `${attention.label} vraagt aandacht (${attention.changePercent! >= 0 ? "+" : ""}${attention.changePercent!.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}% maand-op-maand).`,
    );
  }
  if (comparable.length === 0 && metrics.length > 0) {
    lines.push(
      "Er zijn wel algemene websitecijfers beschikbaar, maar die gebruiken we niet als zelfstandig bewijs voor SEO-resultaat.",
    );
  }
  lines.push(
    "De cijfers laten een ontwikkeling zien; ze bewijzen op zichzelf geen direct oorzakelijk verband met één afzonderlijke wijziging.",
  );
  return lines.join(" ");
};

const defaultWorkSummary = (work: WorkCompletion[]): string =>
  work.length > 0
    ? work.map((item) => `• ${item.task_text}`).join("\n")
    : "Er zijn voor deze meetmaand nog geen afgeronde werkzaamheden geregistreerd.";

const generateMonthlyReport = async (
  deal: JsonObject,
  link: InzyteLink | null,
  saleId: number,
  requestedMonth: unknown,
) => {
  if (!link) {
    throw userError("Koppel deze opdracht eerst aan een Inzyte-account.", 409);
  }
  const hasGa4 = Boolean(link.ga4_connection_id && link.ga4_property_id);
  const hasGsc = Boolean(link.gsc_site_url);
  if (!hasGa4 && !hasGsc) {
    throw userError(
      "Koppel minimaal GA4 of Search Console om een maandrapport te maken.",
      409,
    );
  }

  const period = monthlyReportPeriod(requestedMonth);
  const dealId = Number(deal.id);
  const [work, ga4Current, ga4Previous, gscCurrent, gscPrevious] =
    await Promise.all([
      loadMonthlyWorkContext(dealId, period),
      settleMonthlyAction({
        enabled: hasGa4,
        action: "overview",
        dealId,
        saleId,
        link,
        startDate: period.currentStart,
        endDate: period.currentEnd,
      }),
      settleMonthlyAction({
        enabled: hasGa4,
        action: "overview",
        dealId,
        saleId,
        link,
        startDate: period.previousStart,
        endDate: period.previousEnd,
      }),
      settleMonthlyAction({
        enabled: hasGsc,
        action: "search_console",
        dealId,
        saleId,
        link,
        startDate: period.currentStart,
        endDate: period.currentEnd,
      }),
      settleMonthlyAction({
        enabled: hasGsc,
        action: "search_console",
        dealId,
        saleId,
        link,
        startDate: period.previousStart,
        endDate: period.previousEnd,
      }),
    ]);
  const successfulSources = [
    ga4Current,
    ga4Previous,
    gscCurrent,
    gscPrevious,
  ].filter((source) => source.status === "success").length;
  if (successfulSources === 0) {
    throw userError(
      "GA4 en Search Console konden geen meetgegevens leveren. Controleer de koppelingen en probeer opnieuw.",
      409,
    );
  }

  const sourceData = (source: MonthlySourceResult): unknown =>
    source.status === "success" ? source.data : undefined;
  const metrics = buildMonthlyHeadlineMetrics({
    ga4Current: sourceData(ga4Current),
    ga4Previous: sourceData(ga4Previous),
    gscCurrent: sourceData(gscCurrent),
    gscPrevious: sourceData(gscPrevious),
  });
  const companyName =
    (isRecord(deal.companies) && optionalText(deal.companies.name)) ||
    optionalText(deal.name) ||
    "de klant";
  const title = `SEO-maandupdate ${monthLabel(period.reportingMonth)}`;
  const clientSummary = defaultClientSummary({
    companyName,
    period,
    metrics,
    workCount: work.currentCount,
  });
  const reportData = {
    version: 1,
    generatedAt: new Date().toISOString(),
    period,
    assignment: {
      id: deal.id,
      name: deal.name,
      description: deal.description,
      category: deal.category,
      createdAt: deal.created_at,
      recurring: deal.revenue_period === "maandelijks",
    },
    sources: {
      ga4: { current: ga4Current, previous: ga4Previous },
      searchConsole: { current: gscCurrent, previous: gscPrevious },
    },
    work: {
      current: work.current,
      allTime: work.allTime,
      allTimeCount: work.allTimeCount,
      allTimeNoteCount: work.allTimeNoteCount,
      allTimeInternalActivity: work.allTimeInternalActivity,
      currentInternalActivity: work.currentInternalActivity,
    },
    financialSnapshot: {
      estimateId: deal.moneybird_estimate_id,
      estimateState: deal.moneybird_estimate_live_state,
      estimateCheckedAt: deal.moneybird_estimate_checked_at,
      invoiceId: deal.moneybird_invoice_id,
      invoiceState: deal.moneybird_invoice_live_state,
      invoiceCheckedAt: deal.moneybird_invoice_checked_at,
    },
  };
  const hasCurrentPeriodData =
    ga4Current.status === "success" || gscCurrent.status === "success";

  const { data: report, error } = await supabaseAdmin
    .from("seo_monthly_reports")
    .upsert(
      {
        deal_id: dealId,
        company_id: deal.company_id ? Number(deal.company_id) : null,
        reporting_month: period.reportingMonth,
        current_start: period.currentStart,
        current_end: period.currentEnd,
        previous_start: period.previousStart,
        previous_end: period.previousEnd,
        data_through: hasCurrentPeriodData
          ? period.currentEnd
          : period.previousEnd,
        status: "draft",
        title,
        client_summary: clientSummary,
        work_summary: defaultWorkSummary(work.current),
        next_steps:
          "Bespreek de belangrijkste ontwikkeling, leg de prioriteiten voor de komende maand vast en registreer elke afgeronde SEO-stap in de opdracht.",
        report_data: reportData,
        headline_metrics: metrics,
        current_work_count: work.currentCount,
        all_time_work_count: work.allTimeCount,
        generated_by: saleId,
        generated_at: new Date().toISOString(),
        finalized_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "deal_id,reporting_month" },
    )
    .select("*")
    .single();
  if (error || !report) {
    throw error || new Error("SEO-maandrapport opslaan is mislukt.");
  }
  return report;
};

const finalizeMonthlyReport = async (
  dealId: number,
  saleId: number,
  body: JsonObject,
) => {
  const reportId = requiredPositiveInteger(body.reportId);
  if (!reportId) throw userError("Kies eerst een maandrapport.");
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("seo_monthly_reports")
    .select("*")
    .eq("id", reportId)
    .eq("deal_id", dealId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!existing) throw userError("Dit maandrapport is niet gevonden.", 404);

  const clientSummary =
    optionalText(body.clientSummary, 20_000) || existing.client_summary;
  const workSummary =
    optionalText(body.workSummary, 20_000) || existing.work_summary;
  const nextSteps = optionalText(body.nextSteps, 20_000) || existing.next_steps;
  const finalizedAt = new Date().toISOString();
  const { data: report, error: updateError } = await supabaseAdmin
    .from("seo_monthly_reports")
    .update({
      status: "final",
      client_summary: clientSummary,
      work_summary: workSummary,
      next_steps: nextSteps,
      finalized_at: finalizedAt,
      updated_at: finalizedAt,
    })
    .eq("id", reportId)
    .eq("deal_id", dealId)
    .select("*")
    .single();
  if (updateError || !report) {
    throw updateError || new Error("SEO-maandrapport afronden is mislukt.");
  }

  const noteText =
    optionalText(body.noteText, 30_000) ||
    [
      report.title,
      `Meetperiode: ${report.current_start} t/m ${report.current_end} vergeleken met ${report.previous_start} t/m ${report.previous_end}.`,
      clientSummary,
      "Werkzaamheden:",
      workSummary,
      "Volgende stappen:",
      nextSteps,
    ]
      .filter(Boolean)
      .join("\n\n");
  const sourceEventId = `seo-monthly-report:${report.id}`;
  const { data: note } = await supabaseAdmin
    .from("deal_notes")
    .select("id")
    .eq("deal_id", dealId)
    .eq("source_event_id", sourceEventId)
    .maybeSingle();
  if (note) {
    const { error } = await supabaseAdmin
      .from("deal_notes")
      .update({ text: noteText, date: finalizedAt, sales_id: saleId })
      .eq("id", note.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("deal_notes").insert({
      deal_id: dealId,
      type: "SEO-maandrapport",
      text: noteText,
      date: finalizedAt,
      sales_id: saleId,
      activity_source: "manual",
      activity_source_author: "CRM + Inzyte",
      source_event_id: sourceEventId,
    });
    if (error) throw error;
  }
  return report;
};

const saveRunAsNote = async (
  dealId: number,
  saleId: number,
  runId: number,
  noteText: string | null,
) => {
  const { data: run, error } = await supabaseAdmin
    .from("inzyte_runs")
    .select("id, action, status, date_start, date_end, started_at, summary")
    .eq("id", runId)
    .eq("deal_id", dealId)
    .maybeSingle();
  if (error) throw error;
  if (!run) throw userError("Dit Inzyte-resultaat is niet gevonden.", 404);

  const sourceEventId = `inzyte:${run.id}`;
  const { data: existing } = await supabaseAdmin
    .from("deal_notes")
    .select("id")
    .eq("deal_id", dealId)
    .eq("source_event_id", sourceEventId)
    .maybeSingle();
  if (existing) {
    if (noteText) {
      const { error: updateError } = await supabaseAdmin
        .from("deal_notes")
        .update({ text: noteText, date: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      return { noteId: existing.id, alreadyExisted: true, updated: true };
    }
    return { noteId: existing.id, alreadyExisted: true, updated: false };
  }

  const labels: Record<string, string> = {
    overview: "overzichtsanalyse",
    report: "rapportage",
    trend: "trendanalyse",
    realtime: "live-analyse",
    traffic: "verkeersanalyse",
    pages: "pagina-analyse",
    conversions: "conversie-analyse",
    events: "gebeurtenissenanalyse",
    campaigns: "campagne-analyse",
    search_console: "Search Console-analyse",
    business_profile: "Bedrijfsprofiel-analyse",
    google_ads: "Google Ads-analyse",
    audience: "doelgroepanalyse",
    audience_intelligence: "doelgroepintelligentie",
    kpi_insights: "AI KPI-analyse",
    practical_recommendations: "praktische AI-aanbevelingen",
    comprehensive_analysis: "uitgebreide AI-analyse",
    deep_analysis: "strategische diepte-analyse",
    section_analysis: "AI-sectieanalyse",
    vraagbaak: "Vraagbaak-analyse",
  };
  const period =
    run.date_start && run.date_end
      ? `\nPeriode: ${run.date_start} t/m ${run.date_end}`
      : "";
  const text =
    noteText ||
    [
      `Inzyte ${labels[run.action] || run.action} uitgevoerd.`,
      period.trim(),
      `Status: ${run.status === "success" ? "afgerond" : run.status}.`,
      `Samenvatting: ${JSON.stringify(run.summary || {})}`,
    ]
      .filter(Boolean)
      .join("\n");

  const { data: note, error: noteError } = await supabaseAdmin
    .from("deal_notes")
    .insert({
      deal_id: dealId,
      type: "Inzyte",
      text,
      date: new Date().toISOString(),
      sales_id: saleId,
      activity_source: "manual",
      activity_source_author: "Inzyte vanuit CRM",
      source_event_id: sourceEventId,
    })
    .select("id")
    .single();
  if (noteError || !note)
    throw noteError || new Error("Notitie opslaan is mislukt.");
  return { noteId: note.id, alreadyExisted: false };
};

const handleRequest = async (
  req: Request,
  user: NonNullable<Parameters<typeof getUserSale>[0]>,
): Promise<Response> => {
  if (req.method !== "POST")
    return createErrorResponse(405, "Method Not Allowed");

  let body: JsonObject;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed))
      return createErrorResponse(400, "Ongeldige aanvraag.");
    body = parsed;
  } catch {
    return createErrorResponse(400, "Ongeldige aanvraag.");
  }

  const dealId = requiredPositiveInteger(body.dealId);
  const action = optionalText(body.action, 80);
  if (!dealId || !action) {
    return createErrorResponse(400, "Opdracht en actie zijn verplicht.");
  }

  const sale = await getUserSale(user);
  if (!sale || sale.disabled === true)
    return createErrorResponse(401, "Unauthorized");
  const context = await getDealContext(dealId, sale as JsonObject);
  if (context.error === "not_found")
    return createErrorResponse(404, "Opdracht niet gevonden.");
  if (context.error === "forbidden")
    return createErrorResponse(403, "Geen toegang tot deze opdracht.");
  const deal = context.deal as JsonObject;
  let link = await getLink(dealId);

  try {
    switch (action) {
      case "bootstrap":
        return jsonResponse({ data: await loadBootstrap(deal, link) });
      case "save_link":
        link = await saveLink(deal, Number(sale.id), body);
        return jsonResponse({ data: { link } });
      case "unlink": {
        if (link) {
          const { error } = await supabaseAdmin
            .from("inzyte_links")
            .delete()
            .eq("id", link.id);
          if (error) throw error;
        }
        return jsonResponse({ data: { unlinked: true } });
      }
      case "setup_sources": {
        const userId = optionalUuid(body.inzyteUserId) || link?.inzyte_user_id;
        const connectionId =
          optionalUuid(body.ga4ConnectionId) || link?.ga4_connection_id || null;
        if (!userId) throw userError("Kies eerst een Inzyte-account.");
        return jsonResponse({
          data: await loadSetupSources(userId, connectionId),
        });
      }
      case "oauth_url": {
        const userId = optionalUuid(body.inzyteUserId) || link?.inzyte_user_id;
        const provider = optionalText(body.provider, 40);
        if (!userId || !provider)
          throw userError("Kies een account en gegevensbron.");
        const originHeader = req.headers.get("origin");
        const returnOrigin =
          originHeader && /^https?:\/\//.test(originHeader)
            ? originHeader
            : Deno.env.get("CRM_PUBLIC_URL") || "https://crm.marketingbende.nl";
        const result = await callInzyte("oauth-url", {
          userId,
          method: "POST",
          body: { provider, returnOrigin },
        });
        return jsonResponse({ data: result });
      }
      case "save_note": {
        const runId = requiredPositiveInteger(body.runId);
        if (!runId) throw userError("Kies eerst een opgeslagen resultaat.");
        return jsonResponse({
          data: await saveRunAsNote(
            dealId,
            Number(sale.id),
            runId,
            optionalText(body.noteText, 20_000),
          ),
        });
      }
      case "monthly_report":
        return jsonResponse({
          data: await generateMonthlyReport(
            deal,
            link,
            Number(sale.id),
            body.reportingMonth,
          ),
        });
      case "finalize_monthly_report":
        return jsonResponse({
          data: await finalizeMonthlyReport(dealId, Number(sale.id), body),
        });
      default: {
        if (!INZYTE_ACTIONS.has(action as InzyteAction)) {
          return createErrorResponse(400, "Onbekende Inzyte-actie.");
        }
        if (!link) {
          return createErrorResponse(
            409,
            "Koppel deze opdracht eerst aan een Inzyte-account.",
          );
        }
        const { result, runId } = await runRemoteAction(
          action as InzyteAction,
          dealId,
          Number(sale.id),
          link,
          body,
        );
        return jsonResponse({ data: { result, runId } });
      }
    }
  } catch (error) {
    const isUserError = error instanceof InzyteUserError;
    const message = isUserError ? error.message : safeRunError(error);
    console.error(
      `inzyte action ${action} failed for deal ${dealId}:`,
      error instanceof Error ? error.name : "UnknownError",
    );
    return createErrorResponse(isUserError ? error.status : 502, message);
  }
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) =>
        user
          ? handleRequest(req, user)
          : createErrorResponse(401, "Unauthorized"),
      ),
    ),
  ),
);
