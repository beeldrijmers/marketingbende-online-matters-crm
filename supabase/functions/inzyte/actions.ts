export type InzyteAction =
  | "overview"
  | "report"
  | "trend"
  | "realtime"
  | "traffic"
  | "pages"
  | "conversions"
  | "events"
  | "campaigns"
  | "highlights"
  | "source_products"
  | "detailed"
  | "custom_dimensions"
  | "annotations"
  | "search_console"
  | "business_profile"
  | "google_ads"
  | "ai_insights"
  | "audience"
  | "audience_intelligence"
  | "kpi_insights"
  | "practical_recommendations"
  | "comprehensive_analysis"
  | "deep_analysis"
  | "section_analysis"
  | "conversion_analysis"
  | "executive_summary"
  | "strategic_recommendations"
  | "vraagbaak";

export type InzyteLinkAddress = {
  ga4_connection_id?: string | null;
  ga4_property_id?: string | null;
  ga4_property_name?: string | null;
  website_url?: string | null;
  gsc_site_url?: string | null;
  gbp_account_id?: string | null;
  gbp_location_id?: string | null;
  gbp_location_name?: string | null;
  ads_customer_id?: string | null;
  ads_login_customer_id?: string | null;
};

export type RemoteRequest = {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  requiresGa4: boolean;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && ISO_DATE_RE.test(value);

export const normalizeDateRange = (
  startDate: unknown,
  endDate: unknown,
  now = new Date(),
): { startDate: string; endDate: string } => {
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 29);
  const fallback = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return fallback;
  if (startDate > endDate) return fallback;
  return { startDate, endDate };
};

const sanitizePayload = (value: unknown, depth = 0): unknown => {
  if (depth > 8) return null;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 250).map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            key !== "__proto__" && key !== "prototype" && key !== "constructor",
        )
        .slice(0, 100)
        .map(([key, item]) => [key, sanitizePayload(item, depth + 1)]),
    );
  }
  return null;
};

const cleanPayload = (payload: unknown): Record<string, unknown> => {
  const cleaned = sanitizePayload(payload);
  return cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)
    ? (cleaned as Record<string, unknown>)
    : {};
};

export const buildRemoteRequest = (
  action: InzyteAction,
  link: InzyteLinkAddress,
  input: {
    startDate?: unknown;
    endDate?: unknown;
    question?: unknown;
    payload?: unknown;
    forceRefresh?: unknown;
  },
): RemoteRequest => {
  const range = normalizeDateRange(input.startDate, input.endDate);
  const extra = cleanPayload(input.payload);
  const ga4 = {
    ...extra,
    connectionId: link.ga4_connection_id,
    propertyId: link.ga4_property_id,
  };
  const datedGa4 = {
    ...ga4,
    startDate: range.startDate,
    endDate: range.endDate,
    dateRange: range,
  };

  switch (action) {
    case "overview":
      return {
        path: "ga4/analytics-data",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "report": {
      const days = Math.min(
        Math.max(
          Math.round(
            (Date.parse(range.endDate) - Date.parse(range.startDate)) /
              86_400_000,
          ) + 1,
          1,
        ),
        366,
      );
      return {
        path: "report",
        method: "POST",
        body: { ...ga4, days },
        requiresGa4: true,
      };
    }
    case "trend":
      return {
        path: "ga4/daily-trend",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "realtime":
      return {
        path: "ga4/realtime",
        method: "POST",
        body: ga4,
        requiresGa4: true,
      };
    case "traffic":
      return {
        path: "ga4/traffic-analytics-full",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "pages":
      return {
        path: "ga4/pages-conversions",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "conversions":
      return {
        path: "ga4/goals",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "events":
      return {
        path: "ga4/events-analytics",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "campaigns":
      return {
        path: "ga4/utm-analytics",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "highlights":
      return {
        path: "ga4/data-highlights",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "source_products":
      return {
        path: "ga4/source-products",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "detailed":
      return {
        path: "ga4/detailed-analytics",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "custom_dimensions":
      return {
        path: "ga4/custom-dimensions",
        method: "POST",
        body: ga4,
        requiresGa4: true,
      };
    case "annotations":
      return {
        path: "ga4/annotations",
        method: "POST",
        body: datedGa4,
        requiresGa4: true,
      };
    case "search_console":
      return {
        path: "search-console",
        method: "POST",
        body: {
          startDate: range.startDate,
          endDate: range.endDate,
          siteUrl: link.gsc_site_url,
          forceRefresh: input.forceRefresh === true,
        },
        requiresGa4: false,
      };
    case "business_profile":
      return {
        path: "business-profile",
        method: "POST",
        body: {
          startDate: range.startDate,
          endDate: range.endDate,
          accountId: link.gbp_account_id,
          locationId: link.gbp_location_id,
          locationName: link.gbp_location_name,
          forceRefresh: input.forceRefresh === true,
        },
        requiresGa4: false,
      };
    case "google_ads":
      return {
        path: "google-ads",
        method: "POST",
        body: {
          startDate: range.startDate,
          endDate: range.endDate,
          customerId: link.ads_customer_id,
          loginCustomerId: link.ads_login_customer_id,
          forceRefresh: input.forceRefresh === true,
        },
        requiresGa4: false,
      };
    case "ai_insights":
      return {
        path: "analytics-insights/generate",
        method: "POST",
        body: {
          ...ga4,
          analyticsData: extra.analyticsData || extra,
          forceRefresh: input.forceRefresh === true,
          language: "nl",
        },
        requiresGa4: true,
      };
    case "audience":
    case "audience_intelligence":
      return {
        path:
          action === "audience_intelligence"
            ? "analytics-insights/audience-intelligence"
            : "analytics-insights/audience-analysis",
        method: "POST",
        body: {
          ...ga4,
          visitorData: extra.visitorData || extra,
          comprehensiveData: extra.comprehensiveData,
          websiteUrl: link.website_url,
          language: "nl",
        },
        requiresGa4: true,
      };
    case "kpi_insights":
    case "practical_recommendations":
    case "comprehensive_analysis":
    case "deep_analysis": {
      const structuredPath = {
        kpi_insights: "generate",
        practical_recommendations: "practical",
        comprehensive_analysis: "comprehensive",
        deep_analysis: "deep-analysis",
      }[action];
      const kpiData = extra.kpiData || extra.analyticsData || extra;
      return {
        path: `analytics-insights-structured/${structuredPath}`,
        method: "POST",
        body: {
          kpiData,
          healthScore: extra.healthScore,
          dateRange: range,
          industry: extra.industry,
          businessContext: extra.businessContext,
          detailedAnalytics: extra.detailedAnalytics,
          dataHighlights: extra.dataHighlights,
          aiInsights: extra.aiInsights,
          language: "nl",
        },
        requiresGa4: true,
      };
    }
    case "section_analysis": {
      const allowedSections = new Set([
        "traffic_comprehensive",
        "user_behavior_comprehensive",
        "ecommerce_comprehensive",
        "geographic_comprehensive",
        "demographics_comprehensive",
        "content_comprehensive",
        "realtime_comprehensive",
        "trends_comprehensive",
      ]);
      const requestedSection =
        typeof extra.sectionType === "string" ? extra.sectionType : "";
      const sectionType = allowedSections.has(requestedSection)
        ? requestedSection
        : "traffic_comprehensive";
      return {
        path: "analytics-insights/section-analysis",
        method: "POST",
        body: {
          sectionType,
          data: extra.data || extra.analyticsData || extra,
          language: "nl",
        },
        requiresGa4: true,
      };
    }
    case "conversion_analysis":
    case "executive_summary":
    case "strategic_recommendations":
      return {
        path: `analytics-insights/${action.replaceAll("_", "-")}`,
        method: "POST",
        body: { ...datedGa4, ...extra, language: "nl" },
        requiresGa4: true,
      };
    case "vraagbaak":
      return {
        path: "vraagbaak/ask",
        method: "POST",
        body: {
          ...extra,
          question:
            typeof input.question === "string"
              ? input.question.slice(0, 2_000)
              : "Analyseer deze website en benoem de belangrijkste kansen en acties.",
          propertyId: link.ga4_property_id,
          connectionId: link.ga4_connection_id,
          propertyName: link.ga4_property_name,
          dateRange: range,
          language: "nl",
        },
        requiresGa4: true,
      };
  }
};

export const TRACKED_ACTIONS = new Set<InzyteAction>([
  "overview",
  "report",
  "trend",
  "realtime",
  "traffic",
  "pages",
  "conversions",
  "events",
  "campaigns",
  "highlights",
  "source_products",
  "detailed",
  "search_console",
  "business_profile",
  "google_ads",
  "ai_insights",
  "audience",
  "audience_intelligence",
  "kpi_insights",
  "practical_recommendations",
  "comprehensive_analysis",
  "deep_analysis",
  "section_analysis",
  "conversion_analysis",
  "executive_summary",
  "strategic_recommendations",
  "vraagbaak",
]);

export const INZYTE_ACTIONS = new Set<InzyteAction>(TRACKED_ACTIONS);
INZYTE_ACTIONS.add("custom_dimensions");
INZYTE_ACTIONS.add("annotations");
