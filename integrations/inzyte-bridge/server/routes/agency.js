/**
 * Private CRM agency bridge.
 *
 * This router is only mounted below /api/v1/agency. The shared secret is held
 * by the CRM edge function; browsers never receive it. Once authenticated, the
 * existing Inzyte routers run as the selected Inzyte user so every established
 * analytics capability stays available without duplicating business logic.
 */

const crypto = require("crypto");
const express = require("express");
const { supabase } = require("../utils/supabase-client");
const { secureLogger } = require("../utils/secure-logger");
const { generateOAuthState } = require("../utils/oauth-state");
const { buildReportData } = require("../utils/reports/report-data");
const {
  fetchSearchConsoleData,
} = require("../utils/search-console-integration");
const {
  fetchBusinessProfileData,
} = require("../utils/business-profile-integration");
const { fetchGoogleAdsData } = require("../utils/google-ads-integration");

const router = express.Router();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function allowedReturnOrigins() {
  return String(
    process.env.CRM_RETURN_ORIGINS ||
      "https://crm.marketingbende.nl,http://localhost:5173,http://127.0.0.1:5173",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeAllowedOrigin(value) {
  try {
    const origin = new URL(String(value || "")).origin;
    return allowedReturnOrigins().includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

function requireAgencySecret(req, res, next) {
  const expected = process.env.CRM_AGENCY_SECRET;
  if (!expected) {
    secureLogger.error("CRM_AGENCY_SECRET is not configured");
    return res.status(503).json({ error: "Agency bridge is not configured" });
  }

  const provided = req.get("X-Inzyte-Agency-Secret");
  if (!timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.isAgency = true;
  req.supabase = supabase;
  return next();
}

async function resolveAgencyUser(req, res, next) {
  const userId = req.get("X-Inzyte-Agency-User-Id");
  if (!UUID_RE.test(String(userId || ""))) {
    return res.status(400).json({ error: "A valid agency user is required" });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return res.status(404).json({ error: "Inzyte workspace not found" });
  }

  req.user = { id: profile.id, email: profile.email, metadata: {} };
  return next();
}

function safeIntegration(integration) {
  const settings = integration.settings || {};
  const profile = integration.profile_data || {};
  return {
    id: integration.id,
    userId: integration.user_id,
    provider: integration.provider,
    active: integration.is_active === true,
    expiresAt: integration.expires_at || null,
    updatedAt: integration.updated_at || null,
    profile: {
      name: profile.name || null,
      email: profile.email || null,
      picture: profile.picture || null,
    },
    settings: {
      needsReauth: settings.needs_reauth === true,
      reauthReason: settings.reauth_reason || null,
      propertyId: settings.propertyId || settings.property_id || null,
      propertyName: settings.propertyName || settings.property_name || null,
      siteUrl: settings.siteUrl || null,
      accountId: settings.accountId || null,
      locationId: settings.locationId || null,
      locationName: settings.locationName || null,
      customerId: settings.customerId || null,
      accountName: settings.accountName || null,
      loginCustomerId: settings.loginCustomerId || null,
    },
  };
}

router.use(requireAgencySecret);

router.get("/health", (_req, res) => {
  res.json({ success: true, service: "inzyte-agency-bridge" });
});

router.get("/catalog", async (_req, res) => {
  try {
    const [
      { data: profiles, error: profileError },
      { data: accounts },
      { data: integrations, error: integrationError },
    ] = await Promise.all([
      supabase.from("profiles").select("id, email").order("email"),
      supabase
        .from("accounts")
        .select("primary_owner_user_id, name, picture_url")
        .eq("is_personal_account", true),
      supabase
        .from("user_integrations")
        .select(
          "id, user_id, provider, expires_at, profile_data, settings, is_active, updated_at",
        )
        .order("updated_at", { ascending: false }),
    ]);

    if (profileError || integrationError)
      throw profileError || integrationError;
    const accountByUser = new Map(
      (accounts || []).map((account) => [
        account.primary_owner_user_id,
        account,
      ]),
    );
    const safeIntegrations = (integrations || []).map(safeIntegration);

    res.json({
      success: true,
      workspaces: (profiles || []).map((profile) => {
        const account = accountByUser.get(profile.id);
        return {
          id: profile.id,
          email: profile.email,
          name: account?.name || profile.email,
          picture: account?.picture_url || null,
          integrations: safeIntegrations.filter(
            (integration) => integration.userId === profile.id,
          ),
        };
      }),
    });
  } catch (error) {
    secureLogger.error("Agency catalog failed", { error: error.message });
    res
      .status(500)
      .json({ error: "Agency catalog is temporarily unavailable" });
  }
});

router.use(resolveAgencyUser);

router.post("/oauth-url", (req, res) => {
  const provider = String(req.body?.provider || "");
  const returnOrigin =
    normalizeAllowedOrigin(req.body?.returnOrigin) || allowedReturnOrigins()[0];
  const clientId = process.env.GA4_CLIENT_ID;
  const clientSecret = process.env.GA4_CLIENT_SECRET;

  const providers = {
    ga4: {
      stateProvider: "google_ga4",
      redirectUri: process.env.GA4_REDIRECT_URI,
      scopes: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/analytics.readonly",
      ],
    },
    search_console: {
      stateProvider: "google_search_console",
      redirectUri:
        process.env.SC_REDIRECT_URI ||
        String(process.env.GA4_REDIRECT_URI || "").replace(
          "/ga4/callback",
          "/search-console/callback",
        ),
      scopes: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/webmasters.readonly",
      ],
    },
    business_profile: {
      stateProvider: "google_business_profile",
      redirectUri:
        process.env.GBP_REDIRECT_URI ||
        String(process.env.GA4_REDIRECT_URI || "").replace(
          "/ga4/callback",
          "/business-profile/callback",
        ),
      scopes: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/business.manage",
      ],
    },
    google_ads: {
      stateProvider: "google_ads",
      redirectUri:
        process.env.ADS_REDIRECT_URI ||
        String(process.env.GA4_REDIRECT_URI || "").replace(
          "/ga4/callback",
          "/ads/callback",
        ),
      scopes: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/adwords.readonly",
      ],
    },
  };

  const config = providers[provider];
  if (!config) return res.status(400).json({ error: "Unknown provider" });
  if (!clientId || !clientSecret || !config.redirectUri) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }
  if (provider === "google_ads" && !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return res.status(503).json({ error: "Google Ads is not configured" });
  }

  const state = generateOAuthState({
    userId: req.user.id,
    provider: config.stateProvider,
    returnOrigin,
  });
  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
    {
      client_id: clientId,
      redirect_uri: config.redirectUri.trim(),
      response_type: "code",
      scope: config.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
      hl: "nl",
    },
  ).toString()}`;

  res.json({ success: true, authorizationUrl });
});

router.post("/report", async (req, res) => {
  try {
    const data = await buildReportData({
      userId: req.user.id,
      connectionId: req.body?.connectionId,
      propertyId: String(req.body?.propertyId || ""),
      days: Math.min(Math.max(Number(req.body?.days) || 30, 1), 366),
    });
    res.json({ success: true, data });
  } catch (error) {
    secureLogger.error("Agency report failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Report generation failed" });
  }
});

router.post("/search-console", async (req, res) => {
  const data = await fetchSearchConsoleData({
    userId: req.user.id,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate,
    siteUrl: req.body?.siteUrl,
    forceRefresh: req.body?.forceRefresh === true,
  });
  res.json({ success: true, data });
});

router.post("/business-profile", async (req, res) => {
  const data = await fetchBusinessProfileData({
    userId: req.user.id,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate,
    accountId: req.body?.accountId,
    locationId: req.body?.locationId,
    locationName: req.body?.locationName,
    forceRefresh: req.body?.forceRefresh === true,
  });
  res.json({ success: true, data });
});

router.post("/google-ads", async (req, res) => {
  const data = await fetchGoogleAdsData({
    userId: req.user.id,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate,
    customerId: req.body?.customerId,
    loginCustomerId: req.body?.loginCustomerId,
    forceRefresh: req.body?.forceRefresh === true,
  });
  res.json({ success: true, data });
});

// Reuse the complete, battle-tested Inzyte API below the private bridge. The
// authentication middleware recognizes req.isAgency and retains ownership
// checks by using req.user.id for the selected workspace.
router.use("/auth", require("./auth"));
router.use("/integrations", require("./api"));
router.use("/ga4", require("./ga4-api"));
router.use("/ga4-data", require("./ga4-data"));
router.use("/analytics-insights", require("./analytics-insights"));
router.use("/analytics-insights-structured", require("./insights"));
router.use("/vraagbaak", require("./vraagbaak"));

module.exports = router;
