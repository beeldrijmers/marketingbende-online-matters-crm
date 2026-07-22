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

    const responseText = await response.text();
    let payload: unknown = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const remoteMessage = isRecord(payload)
        ? optionalText(payload.message || payload.error, 240)
        : null;
      throw new Error(remoteMessage || `INZYTE_HTTP_${response.status}`);
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
      "id, name, company_id, assignee_ids, sales_id, companies(id, name, website)",
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
  const [catalog, recentRunsResult, suggestedLinkResult] = await Promise.all([
    callInzyte("catalog"),
    supabaseAdmin
      .from("inzyte_runs")
      .select(
        "id, deal_id, inzyte_link_id, action, status, date_start, date_end, started_at, finished_at, result, summary, error",
      )
      .eq("deal_id", deal.id)
      .order("started_at", { ascending: false })
      .limit(20),
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

const saveRunAsNote = async (dealId: number, saleId: number, runId: number) => {
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
  if (existing) return { noteId: existing.id, alreadyExisted: true };

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
  const text = [
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
          data: await saveRunAsNote(dealId, Number(sale.id), runId),
        });
      }
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
