import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  finishIntegrationRun,
  startIntegrationRun,
} from "../_shared/integrationRun.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { siblingVerificationMatch } from "./siblingVerification.ts";
import { verificationFromReport } from "./verificationFromReport.ts";
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
  hasSuccessfulMonthlyComparison,
  monthlyReportPeriod,
  type MonthlyReportPeriod,
} from "./monthlyReport.ts";
import { loadSentGmailContext } from "./gmailReportContext.ts";
import {
  buildDefaultReportNarrative,
  buildNarrativePromptContext,
  buildReportEvidence,
  isNarrativeSupportedByMetrics,
  mergeInzyteNarrative,
  MONTHLY_NARRATIVE_QUESTION,
  sanitizeReportEvidenceText,
  type ReportEvidenceBundle,
  type ReportNarrative,
} from "./reportEvidence.ts";
import {
  pendingReportDeals,
  RECURRING_STAGE,
  REPORTS_PER_RUN,
  runScheduledReports,
  type SchedulableLink,
} from "./scheduledReports.ts";
import {
  searchConsoleRows,
  verifySelectedSources,
} from "./sourceVerification.ts";
import { matchSearchConsoleSite } from "./autoMatchSources.ts";

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
  ga4_verified_at: string | null;
  gsc_verified_at: string | null;
  gbp_verified_at: string | null;
  ads_verified_at: string | null;
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

const DEAL_REPORT_SELECT =
  "id, name, company_id, assignee_ids, sales_id, description, category, created_at, revenue_period, moneybird_estimate_id, moneybird_estimate_live_state, moneybird_estimate_checked_at, moneybird_invoice_id, moneybird_invoice_live_state, moneybird_invoice_checked_at, companies(id, name, website)";

/**
 * De opdracht zoals de rapportage hem nodig heeft, zonder toegangscontrole. De
 * geplande maandtaak heeft geen ingelogde gebruiker om tegen te toetsen, dus die
 * controle hoort een laag hoger te zitten dan het ophalen zelf.
 */
const loadReportDeal = async (dealId: number): Promise<JsonObject | null> => {
  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .select(DEAL_REPORT_SELECT)
    .eq("id", dealId)
    .maybeSingle();
  if (error || !deal) return null;
  const company = Array.isArray(deal.companies)
    ? deal.companies[0] || null
    : deal.companies || null;
  return { ...deal, companies: company };
};

const getDealContext = async (dealId: number, sale: JsonObject) => {
  const deal = await loadReportDeal(dealId);
  if (!deal) return { error: "not_found" as const };

  const saleId = Number(sale.id);
  const assignees = Array.isArray(deal.assignee_ids)
    ? deal.assignee_ids.map(Number)
    : [];
  const isAdmin = sale.administrator === true;
  if (!isAdmin && !assignees.includes(saleId)) {
    return { error: "forbidden" as const };
  }

  return { deal };
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

const safeRunError = (error: unknown, action?: InzyteAction): string => {
  const message = error instanceof Error ? error.message : String(error || "");
  if (
    message.startsWith(
      "De meetbron is correct gekoppeld, maar de AI-vraagfunctie",
    )
  ) {
    return "De meetbron is correct gekoppeld, maar de AI-vraagfunctie kon niet worden uitgevoerd. Controleer de AI-toegang en probeer opnieuw.";
  }
  if (message.includes("abort")) {
    return "Inzyte had te lang nodig om te antwoorden.";
  }
  if (message.includes("not connected") || message.includes("not_connected")) {
    return "Deze gegevensbron is nog niet gekoppeld in Inzyte.";
  }
  if (message.includes("reauth") || message.includes("expired")) {
    return "De Google-koppeling moet opnieuw worden geautoriseerd.";
  }
  if (
    action === "vraagbaak" &&
    /provider|openrouter|openai|api.?key|unauthori[sz]ed|401|er is een fout opgetreden/i.test(
      message,
    )
  ) {
    return "De meetbron is correct gekoppeld, maar de AI-vraagfunctie heeft geen geldige AI-toegang. Vernieuw de AI-sleutel van het analyseplatform en probeer daarna opnieuw.";
  }
  return "Inzyte kon deze opdracht nu niet uitvoeren. Controleer de koppelingen en probeer opnieuw.";
};

const safeUserErrorMessage = (error: InzyteUserError): string => {
  switch (error.message) {
    case "Kies eerst een geldig Inzyte-account.":
      return "Kies eerst een geldig Inzyte-account.";
    case "Dit Inzyte-account is niet beschikbaar.":
      return "Dit Inzyte-account is niet beschikbaar.";
    case "De gekozen GA4-koppeling hoort niet bij dit Inzyte-account.":
      return "De gekozen GA4-koppeling hoort niet bij dit Inzyte-account.";
    case "Kies een geldige GA4-property.":
      return "Kies een geldige GA4-property.";
    case "Koppel eerst een GA4-account en property aan deze opdracht.":
      return "Koppel eerst een GA4-account en property aan deze opdracht.";
    case "Deze meetbron is nog niet live gecontroleerd voor deze opdracht. Open Koppelingen en sla de bron opnieuw op.":
      return "Deze meetbron is nog niet live gecontroleerd voor deze opdracht. Open Koppelingen en sla de bron opnieuw op.";
    case "Kies eerst een maandrapport.":
      return "Kies eerst een maandrapport.";
    case "Dit maandrapport is niet gevonden.":
      return "Dit maandrapport is niet gevonden.";
    case "Schrijf eerst een bruikbare samenvatting voor de klant.":
      return "Schrijf eerst een bruikbare samenvatting voor de klant.";
    case "Leg eerst de concrete werkzaamheden uit deze rapportagemaand vast.":
      return "Leg eerst de concrete werkzaamheden uit deze rapportagemaand vast.";
    case "Leg eerst uit wat de voortgang praktisch voor de klant betekent.":
      return "Leg eerst uit wat de voortgang praktisch voor de klant betekent.";
    case "Leg eerst de eerlijke aandachtspunten voor de klant vast.":
      return "Leg eerst de eerlijke aandachtspunten voor de klant vast.";
    case "Leg eerst de concrete focus voor komende maand vast.":
      return "Leg eerst de concrete focus voor komende maand vast.";
    case "Dit Inzyte-resultaat is niet gevonden.":
      return "Dit Inzyte-resultaat is niet gevonden.";
    case "Kies eerst een Inzyte-account.":
      return "Kies eerst een Inzyte-account.";
    case "Kies een account en gegevensbron.":
      return "Kies een account en gegevensbron.";
    case "Kies eerst een opgeslagen resultaat.":
      return "Kies eerst een opgeslagen resultaat.";
    default:
      return "De aanvraag kon niet worden verwerkt. Controleer de invoer en probeer opnieuw.";
  }
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
  let selectedConnection: JsonObject | null = null;
  if (connectionId) {
    const integrations = Array.isArray(workspace.integrations)
      ? workspace.integrations
      : [];
    const connection = integrations.find(
      (integration) =>
        isRecord(integration) &&
        integration.id === connectionId &&
        integration.provider === "google_ga4" &&
        integration.active === true,
    );
    if (!connection || !isRecord(connection)) {
      throw userError(
        "De gekozen GA4-koppeling hoort niet bij dit Inzyte-account.",
      );
    }
    selectedConnection = connection;
  }

  const propertyId = optionalText(body.ga4PropertyId, 40);
  if (propertyId && !/^\d+$/.test(propertyId)) {
    throw userError("Kies een geldige GA4-property.");
  }

  const websiteUrl = optionalWebsite(body.websiteUrl);
  const requestedGscSiteUrl = optionalText(body.gscSiteUrl, 2_000);
  const gbpLocationId = optionalText(body.gbpLocationId);
  const adsCustomerId =
    optionalText(body.adsCustomerId, 40)?.replace(/-/g, "") || null;
  const setupSources = await loadSetupSources(inzyteUserId, connectionId);
  // Niets gekozen? Dan koppelen we de Search Console-property zelf, mits de
  // website van de opdracht er onmiskenbaar naar wijst. Zo blijft die bron niet
  // maandenlang leeg staan puur omdat niemand de keuzelijst heeft opengeklapt.
  const gscSiteUrl =
    requestedGscSiteUrl ||
    matchSearchConsoleSite(
      websiteUrl,
      searchConsoleRows(setupSources.searchConsole),
    ).siteUrl;
  let verifiedSources: ReturnType<typeof verifySelectedSources>;
  try {
    verifiedSources = verifySelectedSources(
      {
        websiteUrl,
        ga4ConnectionId: connectionId,
        ga4PropertyId: propertyId,
        gscSiteUrl,
        gbpLocationId,
        adsCustomerId,
      },
      setupSources,
    );
  } catch (error) {
    throw userError(
      error instanceof Error
        ? error.message
        : "De gekozen meetbronnen konden niet live worden gecontroleerd.",
    );
  }

  const now = new Date().toISOString();
  const hasVerifiedSource = Object.values(verifiedSources).some(Boolean);
  const connectionProfile =
    selectedConnection && isRecord(selectedConnection.profile)
      ? selectedConnection.profile
      : null;
  const row = {
    deal_id: Number(deal.id),
    company_id: deal.company_id ? Number(deal.company_id) : null,
    website_url: websiteUrl,
    inzyte_user_id: inzyteUserId,
    ga4_connection_id: connectionId,
    ga4_connection_name:
      (connectionProfile &&
        optionalText(connectionProfile.name || connectionProfile.email)) ||
      optionalText(body.ga4ConnectionName),
    ga4_property_id: verifiedSources.ga4?.propertyId || null,
    ga4_property_name: verifiedSources.ga4?.propertyName || null,
    gsc_site_url: verifiedSources.gsc?.siteUrl || null,
    gbp_account_id: verifiedSources.gbp?.accountId || null,
    gbp_location_id: verifiedSources.gbp?.locationId || null,
    gbp_location_name: verifiedSources.gbp?.locationName || null,
    ads_customer_id: verifiedSources.ads?.customerId || null,
    ads_account_name: verifiedSources.ads?.accountName || null,
    ads_login_customer_id: verifiedSources.ads?.loginCustomerId || null,
    ga4_verified_at: verifiedSources.ga4 ? now : null,
    gsc_verified_at: verifiedSources.gsc ? now : null,
    gbp_verified_at: verifiedSources.gbp ? now : null,
    ads_verified_at: verifiedSources.ads ? now : null,
    created_by: saleId,
    last_verified_at: hasVerifiedSource ? now : null,
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
  const verificationField = request.requiresGa4
    ? "ga4_verified_at"
    : action === "search_console"
      ? "gsc_verified_at"
      : action === "business_profile"
        ? "gbp_verified_at"
        : action === "google_ads"
          ? "ads_verified_at"
          : null;
  if (
    request.requiresGa4 &&
    (!link.ga4_connection_id || !link.ga4_property_id)
  ) {
    throw userError(
      "Koppel eerst een GA4-account en property aan deze opdracht.",
      409,
    );
  }
  // Bewust geen eis meer dat de bron al bevestigd is. Dezelfde cirkel als bij de
  // rapportage: bevestigen kon alleen door een geslaagde ophaling, en een ophaling
  // mocht alleen bij een bevestigde bron. Een geconfigureerde bron wordt nu
  // geprobeerd; mislukt het, dan komt de echte fout van Google terug in plaats van
  // een verwijzing naar een knop die niets oplost.

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
    const verifiedAt = new Date().toISOString();
    await supabaseAdmin
      .from("inzyte_links")
      .update({
        ...(verificationField ? { [verificationField]: verifiedAt } : {}),
        last_verified_at: verifiedAt,
        last_error: null,
        updated_at: verifiedAt,
      })
      .eq("id", link.id);

    // Dezelfde bron bij dezelfde klant hoeft niet nog eens gecontroleerd te
    // worden. Hunting XL had vier opdrachten met exact deze GA4-property, dus
    // moest je vier keer hetzelfde bevestigen en liet elke rapportage tot dan de
    // cijfers weg. Alleen bij een identieke bron, want een andere property is een
    // andere meting en verdient zijn eigen controle.
    if (verificationField) {
      const sibling = siblingVerificationMatch(link, verificationField);
      if (sibling) {
        const { error: siblingError } = await supabaseAdmin
          .from("inzyte_links")
          .update({ [verificationField]: verifiedAt, updated_at: verifiedAt })
          .eq("company_id", sibling.companyId)
          .eq(sibling.column, sibling.value)
          .is(verificationField, null);
        if (siblingError) {
          // Geen harde fout: deze opdracht is bevestigd, de rest volgt bij een
          // volgende controle.
          console.error(
            "Inzyte sibling verification failed",
            siblingError.code,
          );
        }
      }
    }
    return { result, runId };
  } catch (error) {
    const message = safeRunError(error, action);
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
    if (action !== "vraagbaak") {
      await supabaseAdmin
        .from("inzyte_links")
        .update({
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    }
    throw new Error(message, { cause: error });
  }
};

type MonthlySourceResult =
  | {
      status: "success";
      data: unknown;
      snapshot: unknown;
      runId: number | null;
    }
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

  // Ook hier opschonen, niet alleen in het bewijsmateriaal dat naar de AI gaat.
  // Deze rijen worden namelijk óók onbewerkt in het rapport bewaard, en daar
  // stond zo de complete mailhandtekening van een collega in, telefoonnummer en
  // adres incluis. Een rapportage hoort geen doorslag van interne post te zijn.
  const compactActivity = (rows: JsonObject[]) =>
    rows.map((note) => ({
      ...note,
      text:
        sanitizeReportEvidenceText(
          optionalText(note.text, 4_000) || "",
          1_500,
        ) || "Notitie zonder tekst",
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
  action: "overview" | "search_console" | "business_profile" | "google_ads";
  dealId: number;
  saleId: number;
  link: InzyteLink | null;
  startDate: string;
  endDate: string;
}): Promise<MonthlySourceResult> => {
  if (!enabled) {
    const sourceLabel = {
      overview: "GA4",
      search_console: "Search Console",
      business_profile: "Google Bedrijfsprofiel",
      google_ads: "Google Ads",
    }[action];
    return {
      status: "unavailable",
      error: `${sourceLabel} is niet live gecontroleerd voor deze opdracht.`,
    };
  }
  if (!link) {
    return {
      status: "unavailable",
      error: "Er is geen gecontroleerde meetbron voor deze opdracht.",
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
    return {
      status: "success",
      data: result,
      snapshot: boundedSnapshot(result),
      runId,
    };
  } catch (error) {
    return { status: "failed", error: safeRunError(error) };
  }
};

const storedMonthlySource = (
  source: MonthlySourceResult,
):
  | Omit<Extract<MonthlySourceResult, { status: "success" }>, "snapshot">
  | {
      status: "unavailable" | "failed";
      error: string;
    } =>
  source.status === "success"
    ? {
        status: source.status,
        data: source.snapshot,
        runId: source.runId,
      }
    : source;

const settleMonthlyPair = async ({
  currentStart,
  currentEnd,
  previousStart,
  previousEnd,
  ...actionOptions
}: {
  enabled: boolean;
  action: "overview" | "search_console" | "business_profile" | "google_ads";
  dealId: number;
  saleId: number;
  link: InzyteLink | null;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}): Promise<{
  current: MonthlySourceResult;
  previous: MonthlySourceResult;
}> => {
  const results: MonthlySourceResult[] = [];
  // Deliberately sequential per provider: each overview request fans out into
  // many Google API calls and two simultaneous months exhaust the quota.
  for (const [startDate, endDate] of [
    [currentStart, currentEnd],
    [previousStart, previousEnd],
  ]) {
    results.push(
      await settleMonthlyAction({
        ...actionOptions,
        startDate,
        endDate,
      }),
    );
  }
  const [current, previous] = results as [
    MonthlySourceResult,
    MonthlySourceResult,
  ];
  return { current, previous };
};

const enhanceReportNarrative = async ({
  companyName,
  period,
  metrics,
  evidence,
  link,
}: {
  companyName: string;
  period: MonthlyReportPeriod;
  metrics: ReturnType<typeof buildMonthlyHeadlineMetrics>;
  evidence: ReportEvidenceBundle;
  link: InzyteLink | null;
}): Promise<ReportNarrative> => {
  const fallback = buildDefaultReportNarrative({
    companyName,
    period,
    metrics,
    evidence,
  });
  if (
    metrics.length === 0 ||
    !link ||
    !link.ga4_connection_id ||
    !link.ga4_property_id ||
    !link.ga4_verified_at
  ) {
    return fallback;
  }
  try {
    const response = await callInzyte("vraagbaak/ask", {
      userId: link.inzyte_user_id,
      method: "POST",
      body: {
        question: MONTHLY_NARRATIVE_QUESTION,
        analyticsContext: buildNarrativePromptContext({
          companyName,
          period,
          metrics,
          evidence,
        }),
        propertyId: link.ga4_property_id,
        connectionId: link.ga4_connection_id,
        propertyName: link.ga4_property_name,
        dateRange: {
          startDate: period.currentStart,
          endDate: period.currentEnd,
        },
        language: "nl",
        // Dit is geen gesprek maar een gegevensopdracht. Zonder deze twee regels
        // beantwoordt het chatmodel hem als chat: proza in plaats van JSON, en
        // afgebroken op 1500 tokens middenin een tekstveld. Beide maakten de
        // uitkomst onleesbaar, waarna het rapport terugviel op lege secties.
        responseFormat: "json",
        maxTokens: 6000,
      },
    });
    const enhanced = mergeInzyteNarrative(response, fallback);
    return isNarrativeSupportedByMetrics(enhanced, metrics)
      ? enhanced
      : fallback;
  } catch {
    // The source-backed deterministic narrative remains available if AI is
    // temporarily unavailable or returns an unusable response.
    return fallback;
  }
};

const generateMonthlyReport = async (
  deal: JsonObject,
  link: InzyteLink | null,
  saleId: number,
  requestedMonth: unknown,
) => {
  // Geconfigureerd is genoeg om te proberen. Eerder moest een bron eerst met de
  // hand bevestigd zijn, en bevestigen kon alleen door hem opnieuw op te slaan.
  // Voor koppelingen uit een import sloot die cirkel nooit: achttien koppelingen
  // met een echte property, nul bevestigd, en dus rapportages zonder cijfers
  // terwijl de gegevens er waren. Mislukt een bron, dan meldt de rapportage dat
  // per bron; dat is eerlijker dan stil overslaan.
  const hasGa4 = Boolean(link?.ga4_connection_id && link.ga4_property_id);
  const hasGsc = Boolean(link?.gsc_site_url);
  const hasGbp = Boolean(link?.gbp_location_id);
  const hasAds = Boolean(link?.ads_customer_id);

  const period = monthlyReportPeriod(requestedMonth);
  const dealId = Number(deal.id);
  const [work, ga4, gsc, gbp, ads, sentMail] = await Promise.all([
    loadMonthlyWorkContext(dealId, period),
    settleMonthlyPair({
      enabled: hasGa4,
      action: "overview",
      dealId,
      saleId,
      link,
      currentStart: period.currentStart,
      currentEnd: period.currentEnd,
      previousStart: period.previousStart,
      previousEnd: period.previousEnd,
    }),
    settleMonthlyPair({
      enabled: hasGsc,
      action: "search_console",
      dealId,
      saleId,
      link,
      currentStart: period.currentStart,
      currentEnd: period.currentEnd,
      previousStart: period.previousStart,
      previousEnd: period.previousEnd,
    }),
    settleMonthlyPair({
      enabled: hasGbp,
      action: "business_profile",
      dealId,
      saleId,
      link,
      currentStart: period.currentStart,
      currentEnd: period.currentEnd,
      previousStart: period.previousStart,
      previousEnd: period.previousEnd,
    }),
    settleMonthlyPair({
      enabled: hasAds,
      action: "google_ads",
      dealId,
      saleId,
      link,
      currentStart: period.currentStart,
      currentEnd: period.currentEnd,
      previousStart: period.previousStart,
      previousEnd: period.previousEnd,
    }),
    loadSentGmailContext({ saleId, deal, period }),
  ]);
  const ga4Current = ga4.current;
  const ga4Previous = ga4.previous;
  const gscCurrent = gsc.current;
  const gscPrevious = gsc.previous;
  const gbpCurrent = gbp.current;
  const gbpPrevious = gbp.previous;
  const adsCurrent = ads.current;
  const adsPrevious = ads.previous;
  const hasComparableSource = hasSuccessfulMonthlyComparison([
    { current: ga4Current, previous: ga4Previous },
    { current: gscCurrent, previous: gscPrevious },
    { current: gbpCurrent, previous: gbpPrevious },
    { current: adsCurrent, previous: adsPrevious },
  ]);

  // Data teruggekregen betekent bevestigd. Zo wordt het stempel een uitkomst van
  // een echte ophaling in plaats van een voorwaarde ervoor, en geldt hij meteen
  // voor de andere opdrachten van dezelfde klant met exact dezelfde bron.
  if (link) {
    const earned = verificationFromReport({
      link: link as unknown as Record<string, unknown>,
      ga4: { current: ga4Current, previous: ga4Previous },
      gsc: { current: gscCurrent, previous: gscPrevious },
      gbp: { current: gbpCurrent, previous: gbpPrevious },
      ads: { current: adsCurrent, previous: adsPrevious },
    });
    if (earned.length > 0) {
      const verifiedAt = new Date().toISOString();
      const stamps = Object.fromEntries(
        earned.map((field) => [field, verifiedAt]),
      );
      const { error: stampError } = await supabaseAdmin
        .from("inzyte_links")
        .update({
          ...stamps,
          last_verified_at: verifiedAt,
          updated_at: verifiedAt,
        })
        .eq("id", link.id);
      if (stampError) {
        console.error(
          "Inzyte report verification stamp failed",
          stampError.code,
        );
      }
      for (const field of earned) {
        const sibling = siblingVerificationMatch(link, field);
        if (!sibling) continue;
        await supabaseAdmin
          .from("inzyte_links")
          .update({ [field]: verifiedAt, updated_at: verifiedAt })
          .eq("company_id", sibling.companyId)
          .eq(sibling.column, sibling.value)
          .is(field, null);
      }
    }
  }

  const sourceData = (source: MonthlySourceResult): unknown =>
    source.status === "success" ? source.data : undefined;
  const metrics = buildMonthlyHeadlineMetrics({
    ga4Current: sourceData(ga4Current),
    ga4Previous: sourceData(ga4Previous),
    gscCurrent: sourceData(gscCurrent),
    gscPrevious: sourceData(gscPrevious),
    gbpCurrent: sourceData(gbpCurrent),
    gbpPrevious: sourceData(gbpPrevious),
    adsCurrent: sourceData(adsCurrent),
    adsPrevious: sourceData(adsPrevious),
  });
  const companyName =
    (isRecord(deal.companies) && optionalText(deal.companies.name)) ||
    optionalText(deal.name) ||
    "de klant";
  const title = `Maandrapportage ${monthLabel(period.reportingMonth)}`;
  const evidence = buildReportEvidence({
    assignmentDescription: optionalText(deal.description, 50_000),
    currentWork: work.current,
    allTimeWork: work.allTime,
    currentNotes: work.currentInternalActivity,
    allTimeNotes: work.allTimeInternalActivity,
    sentMail: sentMail.messages,
    gmailStatus: sentMail.status,
    period,
  });
  const narrative = await enhanceReportNarrative({
    companyName,
    period,
    metrics,
    evidence,
    link,
  });
  const reportData = {
    version: 5,
    generatedAt: new Date().toISOString(),
    presentation: { brand: "online_matters" },
    measurement: {
      mode:
        hasComparableSource && metrics.length > 0
          ? "analytics_and_work"
          : "work_only",
      hasComparableMeasurement: hasComparableSource && metrics.length > 0,
      attemptedSources: [
        ...(hasGa4 ? ["GA4"] : []),
        ...(hasGsc ? ["Search Console"] : []),
        ...(hasGbp ? ["Google Bedrijfsprofiel"] : []),
        ...(hasAds ? ["Google Ads"] : []),
      ],
    },
    narrative: {
      interpretation: narrative.interpretation,
      caveats: narrative.caveats,
      generatedBy: narrative.generatedBy,
      reviewed: false,
    },
    period,
    assignment: {
      id: deal.id,
      name: deal.name,
      description: sanitizeReportEvidenceText(
        optionalText(deal.description, 50_000) || "",
        8_000,
      ),
      category: deal.category,
      createdAt: deal.created_at,
      recurring: deal.revenue_period === "maandelijks",
    },
    sources: {
      ga4: {
        current: storedMonthlySource(ga4Current),
        previous: storedMonthlySource(ga4Previous),
      },
      searchConsole: {
        current: storedMonthlySource(gscCurrent),
        previous: storedMonthlySource(gscPrevious),
      },
      businessProfile: {
        current: storedMonthlySource(gbpCurrent),
        previous: storedMonthlySource(gbpPrevious),
      },
      googleAds: {
        current: storedMonthlySource(adsCurrent),
        previous: storedMonthlySource(adsPrevious),
      },
    },
    work: {
      current: work.current,
      allTime: work.allTime,
      allTimeCount: work.allTimeCount,
      allTimeNoteCount: work.allTimeNoteCount,
      allTimeInternalActivity: work.allTimeInternalActivity,
      currentInternalActivity: work.currentInternalActivity,
    },
    evidence: {
      counts: evidence.counts,
      currentCounts: evidence.currentCounts,
      allTimeCounts: evidence.allTimeCounts,
      gmailStatus: evidence.gmailStatus,
      current: evidence.current,
      allTime: evidence.allTime,
      safety: "credentials_removed",
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
    ga4Current.status === "success" ||
    gscCurrent.status === "success" ||
    gbpCurrent.status === "success" ||
    adsCurrent.status === "success";

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
        data_through: hasCurrentPeriodData ? period.currentEnd : null,
        status: "draft",
        title,
        client_summary: narrative.clientSummary,
        work_summary: narrative.workSummary,
        next_steps: narrative.nextSteps,
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
    throw error || new Error("Maandrapport opslaan is mislukt.");
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

  const existingReportData = isRecord(existing.report_data)
    ? existing.report_data
    : {};
  const existingNarrative = isRecord(existingReportData.narrative)
    ? existingReportData.narrative
    : {};
  const safeReportText = (value: unknown, fallback: unknown): string =>
    sanitizeReportEvidenceText(
      optionalText(value, 20_000) || optionalText(fallback, 20_000) || "",
      20_000,
    );
  const clientSummary = safeReportText(
    body.clientSummary,
    existing.client_summary,
  );
  const interpretation = safeReportText(
    body.interpretation,
    existingNarrative.interpretation,
  );
  const workSummary = safeReportText(body.workSummary, existing.work_summary);
  const caveats = safeReportText(body.caveats, existingNarrative.caveats);
  const nextSteps = safeReportText(body.nextSteps, existing.next_steps);
  if (!clientSummary || clientSummary.length < 40) {
    throw userError("Schrijf eerst een bruikbare samenvatting voor de klant.");
  }
  if (
    !workSummary ||
    workSummary.length < 20 ||
    /geen afgeronde werkzaamheden|geen werkzaamheden geregistreerd|vul (?:hier )?.*werkzaamheden/i.test(
      workSummary,
    )
  ) {
    throw userError(
      "Leg eerst de concrete werkzaamheden uit deze rapportagemaand vast.",
    );
  }
  if (!interpretation || interpretation.length < 30) {
    throw userError(
      "Leg eerst uit wat de voortgang praktisch voor de klant betekent.",
    );
  }
  if (!caveats || caveats.length < 20) {
    throw userError(
      "Leg eerst de eerlijke aandachtspunten voor de klant vast.",
    );
  }
  if (!nextSteps || nextSteps.length < 20) {
    throw userError("Leg eerst de concrete focus voor komende maand vast.");
  }
  const reportBrand =
    body.reportBrand === "neutral" ? "neutral" : "online_matters";
  const existingPresentation = isRecord(existingReportData.presentation)
    ? existingReportData.presentation
    : {};
  const finalizedAt = new Date().toISOString();
  const reportData = {
    ...existingReportData,
    presentation: { ...existingPresentation, brand: reportBrand },
    narrative: {
      ...existingNarrative,
      interpretation,
      caveats,
      reviewed: true,
      reviewedAt: finalizedAt,
    },
  };
  const { data: report, error: updateError } = await supabaseAdmin
    .from("seo_monthly_reports")
    .update({
      status: "final",
      client_summary: clientSummary,
      work_summary: workSummary,
      next_steps: nextSteps,
      report_data: reportData,
      finalized_at: finalizedAt,
      updated_at: finalizedAt,
    })
    .eq("id", reportId)
    .eq("deal_id", dealId)
    .select("*")
    .single();
  if (updateError || !report) {
    throw updateError || new Error("Maandrapport afronden is mislukt.");
  }

  const reportMeasurement = isRecord(existingReportData.measurement)
    ? existingReportData.measurement
    : {};
  const existingSources = isRecord(existingReportData.sources)
    ? existingReportData.sources
    : {};
  const sourcePair = (key: string) => {
    const source = isRecord(existingSources[key]) ? existingSources[key] : {};
    return { current: source.current, previous: source.previous };
  };
  const hasComparableMeasurement =
    reportMeasurement.hasComparableMeasurement === true ||
    (Array.isArray(existing.headline_metrics) &&
      existing.headline_metrics.length > 0 &&
      hasSuccessfulMonthlyComparison([
        sourcePair("ga4"),
        sourcePair("searchConsole"),
        sourcePair("businessProfile"),
        sourcePair("googleAds"),
      ]));
  const noteText =
    optionalText(body.noteText, 30_000) ||
    [
      report.title,
      hasComparableMeasurement
        ? `Meetperiode: ${report.current_start} t/m ${report.current_end} vergeleken met ${report.previous_start} t/m ${report.previous_end}.`
        : `Rapportageperiode: ${report.current_start} t/m ${report.current_end}. Er was voor deze rapportage geen volledige gecontroleerde maand-op-maandmeting beschikbaar.`,
      clientSummary,
      "Wat dit betekent:",
      interpretation,
      "Werkzaamheden:",
      workSummary,
      "Eerlijke aandachtspunten:",
      caveats,
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
      type: "Maandrapportage",
      text: noteText,
      date: finalizedAt,
      sales_id: saleId,
      activity_source: "manual",
      activity_source_author: "Online Matters",
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
    const message = isUserError
      ? safeUserErrorMessage(error)
      : "Inzyte kon deze opdracht nu niet uitvoeren. Controleer de koppelingen en probeer opnieuw.";
    console.error(
      `inzyte action ${action} failed for deal ${dealId}:`,
      error instanceof Error ? error.name : "UnknownError",
    );
    return createErrorResponse(isUserError ? error.status : 502, message);
  }
};

/**
 * De maandelijkse ronde: voor elke vaste klant een concept klaarzetten.
 *
 * Geen ingelogde gebruiker, dus de opdracht wordt op naam van zijn eigen
 * eigenaar gegenereerd. Dat is niet alleen administratief netjes: de mailcontext
 * in de rapportage komt uit de Gmail-koppeling van diezelfde eigenaar.
 */
const handleScheduledReports = async (): Promise<Response> => {
  const startedAt = Date.now();
  const period = monthlyReportPeriod(undefined);
  const reportingMonth = period.reportingMonth;

  const { data: recurringDeals, error: dealsError } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("stage", RECURRING_STAGE)
    .is("archived_at", null);
  if (dealsError) return jsonResponse({ error: dealsError.message }, 500);

  const dealIds = (recurringDeals ?? []).map((row) => Number(row.id));
  if (dealIds.length === 0) {
    return jsonResponse({ data: { reportingMonth, generated: 0, pending: 0 } });
  }

  const [{ data: links, error: linksError }, { data: reported }] =
    await Promise.all([
      supabaseAdmin
        .from("inzyte_links")
        .select(
          "deal_id, ga4_connection_id, ga4_property_id, gsc_site_url, gbp_location_id, ads_customer_id",
        )
        .in("deal_id", dealIds),
      supabaseAdmin
        .from("seo_monthly_reports")
        .select("deal_id")
        .eq("reporting_month", reportingMonth)
        .in("deal_id", dealIds),
    ]);
  if (linksError) return jsonResponse({ error: linksError.message }, 500);

  const reportedDealIds = (reported ?? []).map((row) => Number(row.deal_id));
  const allPending = pendingReportDeals({
    links: (links ?? []) as SchedulableLink[],
    reportedDealIds,
    limit: Number.MAX_SAFE_INTEGER,
  });
  const batch = allPending.slice(0, REPORTS_PER_RUN);

  // Niets te doen is de normale uitkomst: de taak draait vaker dan er werk is,
  // zodat een storing bij Google niet betekent dat een klant een maand mist. Dan
  // hoort er ook geen statusregel bij te komen, anders verdrinkt de echte ronde
  // in lege regels.
  if (batch.length === 0) {
    return jsonResponse({ data: { reportingMonth, generated: 0, pending: 0 } });
  }

  const runId = await startIntegrationRun({
    integration: "inzyte",
    runKind: "scheduled",
    startedAt,
  });

  const outcomes = await runScheduledReports({
    dealIds: batch,
    generate: async (dealId) => {
      const deal = await loadReportDeal(dealId);
      if (!deal) throw new Error(`Opdracht ${dealId} niet gevonden.`);
      const ownerId = Number(deal.sales_id);
      if (!Number.isInteger(ownerId) || ownerId <= 0) {
        throw new Error(`Opdracht ${dealId} heeft geen eigenaar.`);
      }
      const link = await getLink(dealId);
      await generateMonthlyReport(
        deal,
        link,
        ownerId,
        reportingMonth.slice(0, 7),
      );
    },
  });

  const failures = outcomes.filter((outcome) => !outcome.ok);
  await finishIntegrationRun({
    runId,
    status: failures.length === 0 ? "success" : "partial",
    durationMs: Date.now() - startedAt,
    itemsProcessed: outcomes.length - failures.length,
    failedCount: failures.length,
    summary: {
      reportingMonth,
      outcomes,
      remaining: allPending.length - batch.length,
    },
    error: failures[0]?.error ?? null,
  });

  return jsonResponse(
    {
      data: {
        reportingMonth,
        generated: outcomes.length - failures.length,
        failed: failures.length,
        pending: allPending.length - batch.length,
        outcomes,
      },
    },
    failures.length > 0 ? 207 : 200,
  );
};

Deno.serve(async (req: Request) => {
  const scheduledSecret = Deno.env.get("INZYTE_REPORT_SECRET");
  if (
    req.method === "POST" &&
    scheduledSecret &&
    req.headers.get("x-inzyte-report-secret") === scheduledSecret
  ) {
    return handleScheduledReports();
  }
  return OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) =>
        user
          ? handleRequest(req, user)
          : createErrorResponse(401, "Unauthorized"),
      ),
    ),
  );
});
