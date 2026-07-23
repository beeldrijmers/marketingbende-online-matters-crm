export type VerificationRecord = Record<string, unknown>;

type SettledSource = {
  ok?: unknown;
  data?: unknown;
};

export type SourceSetupBundle = {
  properties?: unknown;
  searchConsole?: unknown;
  businessProfile?: unknown;
  googleAds?: unknown;
};

export type SourceSelectionInput = {
  websiteUrl: string | null;
  ga4ConnectionId: string | null;
  ga4PropertyId: string | null;
  gscSiteUrl: string | null;
  gbpLocationId: string | null;
  adsCustomerId: string | null;
};

export type VerifiedSourceSelection = {
  ga4: { propertyId: string; propertyName: string } | null;
  gsc: { siteUrl: string } | null;
  gbp: {
    accountId: string | null;
    locationId: string;
    locationName: string;
  } | null;
  ads: {
    customerId: string;
    accountName: string;
    loginCustomerId: string | null;
  } | null;
};

const isRecord = (value: unknown): value is VerificationRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const findNamedArray = (
  value: unknown,
  preferredKeys: string[],
  depth = 0,
): VerificationRecord[] => {
  if (depth > 7) return [];
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) {
      return (value[key] as unknown[]).filter(isRecord);
    }
  }
  for (const child of Object.values(value)) {
    const found = findNamedArray(child, preferredKeys, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
};

const getText = (row: VerificationRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }
  }
  return "";
};

const liveRows = (
  source: unknown,
  preferredKeys: string[],
  label: string,
): VerificationRecord[] => {
  const settled = isRecord(source) ? (source as SettledSource) : null;
  if (!settled || settled.ok !== true) {
    throw new Error(
      `${label} kon niet live worden gecontroleerd. Haal de beschikbare bronnen opnieuw op.`,
    );
  }
  return findNamedArray(settled.data, preferredKeys);
};

const normalizedCustomerId = (value: string): string =>
  value.replaceAll("-", "").trim();

const normalizedDomain = (value: string): string | null => {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith("sc-domain:")) {
    return text.slice("sc-domain:".length).replace(/^www\./, "");
  }
  try {
    const url = new URL(/^https?:\/\//.test(text) ? text : `https://${text}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export const verifySelectedSources = (
  input: SourceSelectionInput,
  sources: SourceSetupBundle,
): VerifiedSourceSelection => {
  let ga4: VerifiedSourceSelection["ga4"] = null;
  if (input.ga4PropertyId) {
    if (!input.ga4ConnectionId) {
      throw new Error("Kies eerst het Google-account van deze GA4-property.");
    }
    const rows = liveRows(
      sources.properties,
      ["properties", "items"],
      "De GA4-property",
    );
    const row = rows.find(
      (item) =>
        getText(item, ["propertyId", "property_id", "id"]) ===
        input.ga4PropertyId,
    );
    if (!row) {
      throw new Error(
        "De gekozen GA4-property staat niet in de live bronnen van dit Google-account.",
      );
    }
    ga4 = {
      propertyId: getText(row, ["propertyId", "property_id", "id"]),
      propertyName:
        getText(row, ["displayName", "display_name", "name"]) ||
        input.ga4PropertyId,
    };
  }

  let gsc: VerifiedSourceSelection["gsc"] = null;
  if (input.gscSiteUrl) {
    const rows = liveRows(
      sources.searchConsole,
      ["sites", "items"],
      "De Search Console-site",
    );
    const row = rows.find(
      (item) =>
        getText(item, ["siteUrl", "site_url", "url"]) === input.gscSiteUrl,
    );
    if (!row) {
      throw new Error(
        "De gekozen Search Console-site staat niet in de live bronnen van dit Google-account.",
      );
    }
    const siteUrl = getText(row, ["siteUrl", "site_url", "url"]);
    const websiteDomain = input.websiteUrl
      ? normalizedDomain(input.websiteUrl)
      : null;
    const searchDomain = normalizedDomain(siteUrl);
    if (
      websiteDomain &&
      searchDomain &&
      websiteDomain !== searchDomain &&
      !websiteDomain.endsWith(`.${searchDomain}`) &&
      !searchDomain.endsWith(`.${websiteDomain}`)
    ) {
      throw new Error(
        `De Search Console-site ${siteUrl} hoort niet bij ${websiteDomain}.`,
      );
    }
    gsc = { siteUrl };
  }

  let gbp: VerifiedSourceSelection["gbp"] = null;
  if (input.gbpLocationId) {
    const rows = liveRows(
      sources.businessProfile,
      ["locations", "items"],
      "De Bedrijfsprofiel-locatie",
    );
    const row = rows.find(
      (item) =>
        getText(item, ["locationId", "location_id", "name"]) ===
        input.gbpLocationId,
    );
    if (!row) {
      throw new Error(
        "De gekozen Bedrijfsprofiel-locatie staat niet in de live bronnen van dit Google-account.",
      );
    }
    gbp = {
      accountId: getText(row, ["accountId", "account_id", "account"]) || null,
      locationId: getText(row, ["locationId", "location_id", "name"]),
      locationName:
        getText(row, ["locationName", "location_name", "title", "name"]) ||
        input.gbpLocationId,
    };
  }

  let ads: VerifiedSourceSelection["ads"] = null;
  if (input.adsCustomerId) {
    const rows = liveRows(
      sources.googleAds,
      ["accounts", "items"],
      "Het Google Ads-account",
    );
    const requestedId = normalizedCustomerId(input.adsCustomerId);
    const row = rows.find(
      (item) =>
        normalizedCustomerId(
          getText(item, ["customerId", "customer_id", "id"]),
        ) === requestedId,
    );
    if (!row) {
      throw new Error(
        "Het gekozen Google Ads-account staat niet in de live bronnen van dit Google-account.",
      );
    }
    ads = {
      customerId: normalizedCustomerId(
        getText(row, ["customerId", "customer_id", "id"]),
      ),
      accountName:
        getText(row, [
          "accountName",
          "account_name",
          "descriptiveName",
          "name",
        ]) || requestedId,
      loginCustomerId:
        normalizedCustomerId(
          getText(row, ["loginCustomerId", "login_customer_id"]),
        ) || null,
    };
  }

  return { ga4, gsc, gbp, ads };
};
