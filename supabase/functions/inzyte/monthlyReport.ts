type JsonObject = Record<string, unknown>;

export type MonthlyReportPeriod = {
  reportingMonth: string;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

export type MonthlyHeadlineMetric = {
  key: string;
  label: string;
  source: "GA4" | "Search Console";
  group: "seo" | "website_context";
  definition: string;
  format: "number" | "percent" | "decimal";
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  favourable: boolean | null;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const startOfUtcMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfUtcMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

export const defaultReportingMonth = (now = new Date()): string => {
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return isoDate(previousMonth).slice(0, 7);
};

export const monthlyReportPeriod = (
  requestedMonth: unknown,
  now = new Date(),
): MonthlyReportPeriod => {
  const fallback = defaultReportingMonth(now);
  const candidate =
    typeof requestedMonth === "string" && MONTH_RE.test(requestedMonth)
      ? requestedMonth
      : fallback;
  const maximum = fallback;
  const reportingMonth = candidate <= maximum ? candidate : maximum;
  const current = startOfUtcMonth(new Date(`${reportingMonth}-01T00:00:00Z`));
  const previous = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1),
  );
  return {
    reportingMonth: isoDate(current),
    currentStart: isoDate(current),
    currentEnd: isoDate(endOfUtcMonth(current)),
    previousStart: isoDate(previous),
    previousEnd: isoDate(endOfUtcMonth(previous)),
  };
};

const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizedKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const numericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/\s/g, "")
    .replace(/%$/, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

type NumericCandidate = {
  value: number;
  score: number;
};

const findScalarMetric = (value: unknown, keys: string[]): number | null => {
  const wanted = new Set(keys.map(normalizedKey));
  const candidates: NumericCandidate[] = [];
  const visit = (item: unknown, path: string[], depth: number) => {
    if (depth > 8 || !isRecord(item)) return;
    for (const [key, child] of Object.entries(item)) {
      const normalized = normalizedKey(key);
      if (wanted.has(normalized)) {
        const number = numericValue(child);
        if (number !== null) {
          const context = path.map(normalizedKey).join(".");
          const preferredContext =
            /summary|total|overall|kpi|metric|overview|aggregate/.test(context)
              ? 30
              : 0;
          candidates.push({
            value: number,
            score: 100 + preferredContext - depth * 2,
          });
        }
      }
      // Arrays often contain per-day/per-page rows. They are deliberately not
      // traversed here: taking the first row would produce a plausible but
      // incorrect monthly KPI.
      if (isRecord(child)) visit(child, [...path, key], depth + 1);
    }
  };
  visit(value, [], 0);
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.value ?? null;
};

const sumArrayMetric = (value: unknown, keys: string[]): number | null => {
  const wanted = new Set(keys.map(normalizedKey));
  const candidates: Array<{ total: number; length: number; depth: number }> =
    [];
  const visit = (item: unknown, depth: number) => {
    if (depth > 7) return;
    if (Array.isArray(item)) {
      let total = 0;
      let matches = 0;
      for (const row of item) {
        if (!isRecord(row)) continue;
        for (const [key, child] of Object.entries(row)) {
          if (!wanted.has(normalizedKey(key))) continue;
          const number = numericValue(child);
          if (number !== null) {
            total += number;
            matches += 1;
          }
        }
      }
      if (matches > 0) candidates.push({ total, length: matches, depth });
      return;
    }
    if (isRecord(item)) {
      Object.values(item).forEach((child) => visit(child, depth + 1));
    }
  };
  visit(value, 0);
  candidates.sort(
    (left, right) => right.length - left.length || left.depth - right.depth,
  );
  return candidates[0]?.total ?? null;
};

const metricValue = (
  payload: unknown,
  keys: string[],
  additive = false,
): number | null =>
  findScalarMetric(payload, keys) ??
  (additive ? sumArrayMetric(payload, keys) : null);

const normalizePercentage = (value: number | null): number | null => {
  if (value === null) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
};

const headlineMetric = ({
  key,
  label,
  source,
  group,
  definition,
  format,
  current,
  previous,
  lowerIsBetter = false,
}: {
  key: string;
  label: string;
  source: "GA4" | "Search Console";
  group: MonthlyHeadlineMetric["group"];
  definition: string;
  format: MonthlyHeadlineMetric["format"];
  current: number | null;
  previous: number | null;
  lowerIsBetter?: boolean;
}): MonthlyHeadlineMetric | null => {
  if (current === null || previous === null) return null;
  const change = current - previous;
  const changePercent =
    previous === 0 ? null : (change / Math.abs(previous)) * 100;
  return {
    key,
    label,
    source,
    group,
    definition,
    format,
    current,
    previous,
    change,
    changePercent,
    favourable: change === 0 ? null : lowerIsBetter ? change < 0 : change > 0,
  };
};

export const buildMonthlyHeadlineMetrics = ({
  ga4Current,
  ga4Previous,
  gscCurrent,
  gscPrevious,
}: {
  ga4Current?: unknown;
  ga4Previous?: unknown;
  gscCurrent?: unknown;
  gscPrevious?: unknown;
}): MonthlyHeadlineMetric[] => {
  const metrics = [
    headlineMetric({
      key: "organicSessions",
      label: "Organische sessies",
      source: "GA4",
      group: "seo",
      definition: "Sessies die GA4 aan het organische zoekkanaal toeschrijft.",
      format: "number",
      current: metricValue(ga4Current, [
        "organicSessions",
        "organicSearchSessions",
      ]),
      previous: metricValue(ga4Previous, [
        "organicSessions",
        "organicSearchSessions",
      ]),
    }),
    headlineMetric({
      key: "sessions",
      label: "Website-sessies",
      source: "GA4",
      group: "website_context",
      definition:
        "Alle gemeten sessies in GA4, dus inclusief verkeer buiten organisch zoeken.",
      format: "number",
      current: metricValue(ga4Current, ["sessions"], true),
      previous: metricValue(ga4Previous, ["sessions"], true),
    }),
    headlineMetric({
      key: "activeUsers",
      label: "Actieve gebruikers",
      source: "GA4",
      group: "website_context",
      definition:
        "Alle actieve gebruikers in GA4; dit cijfer is niet uitsluitend aan SEO toe te schrijven.",
      format: "number",
      current: metricValue(ga4Current, ["activeUsers", "totalUsers"]),
      previous: metricValue(ga4Previous, ["activeUsers", "totalUsers"]),
    }),
    headlineMetric({
      key: "conversions",
      label: "Websiteconversies",
      source: "GA4",
      group: "website_context",
      definition:
        "Alle in GA4 geregistreerde conversies; kanaaltoeschrijving kan meerdere verkeersbronnen omvatten.",
      format: "number",
      current: metricValue(
        ga4Current,
        ["conversions", "keyEvents", "totalConversions"],
        true,
      ),
      previous: metricValue(
        ga4Previous,
        ["conversions", "keyEvents", "totalConversions"],
        true,
      ),
    }),
    headlineMetric({
      key: "clicks",
      label: "Organische klikken",
      source: "Search Console",
      group: "seo",
      definition:
        "Klikken vanuit onbetaalde Google-zoekresultaten naar de website.",
      format: "number",
      current: metricValue(gscCurrent, ["clicks", "totalClicks"], true),
      previous: metricValue(gscPrevious, ["clicks", "totalClicks"], true),
    }),
    headlineMetric({
      key: "impressions",
      label: "Vertoningen",
      source: "Search Console",
      group: "seo",
      definition:
        "Aantal keren dat de website in onbetaalde Google-zoekresultaten is vertoond.",
      format: "number",
      current: metricValue(
        gscCurrent,
        ["impressions", "totalImpressions"],
        true,
      ),
      previous: metricValue(
        gscPrevious,
        ["impressions", "totalImpressions"],
        true,
      ),
    }),
    headlineMetric({
      key: "ctr",
      label: "Klikratio",
      source: "Search Console",
      group: "seo",
      definition:
        "Organische klikken gedeeld door vertoningen in Google Search Console.",
      format: "percent",
      current: normalizePercentage(
        metricValue(gscCurrent, ["ctr", "averageCtr"]),
      ),
      previous: normalizePercentage(
        metricValue(gscPrevious, ["ctr", "averageCtr"]),
      ),
    }),
    headlineMetric({
      key: "position",
      label: "Gemiddelde positie",
      source: "Search Console",
      group: "seo",
      definition:
        "Gemiddelde hoogste positie in Google; een lager getal is doorgaans gunstiger.",
      format: "decimal",
      current: metricValue(gscCurrent, ["position", "averagePosition"]),
      previous: metricValue(gscPrevious, ["position", "averagePosition"]),
      lowerIsBetter: true,
    }),
  ];
  return metrics.filter(
    (metric): metric is MonthlyHeadlineMetric => metric !== null,
  );
};

export const periodDayCount = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;
