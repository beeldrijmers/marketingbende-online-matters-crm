import {
  isInzyteRecord,
  type InzyteJsonRecord,
  unwrapInzyteData,
} from "./inzyteData";

export type InzytePresentationMetric = {
  key: string;
  label: string;
  value: unknown;
  delta: number | null;
};

export type InzytePresentationNarrative = {
  title: string;
  text: string;
};

export type InzytePresentationTable = {
  key: string;
  title: string;
  columns: string[];
  rows: InzyteJsonRecord[];
};

export type InzytePresentation = {
  metrics: InzytePresentationMetric[];
  narratives: InzytePresentationNarrative[];
  scalars: Array<{ key: string; label: string; value: unknown }>;
  tables: InzytePresentationTable[];
};

const FIELD_LABELS: Record<string, string> = {
  account: "Account",
  actions: "Acties",
  activeusers: "Actieve gebruikers",
  ads: "Advertenties",
  analysis: "Analyse",
  answer: "Antwoord",
  averagesessionduration: "Gemiddelde sessieduur",
  averageengagementtime: "Gemiddelde betrokkenheidstijd",
  averageordervalue: "Gemiddelde bestelwaarde",
  bouncerate: "Bouncepercentage",
  browser: "Browser",
  campaign: "Campagne",
  campaigns: "Campagnes",
  channel: "Kanaal",
  channels: "Kanalen",
  city: "Plaats",
  clicks: "Klikken",
  connected: "Verbonden",
  content: "Toelichting",
  conversionrate: "Conversiepercentage",
  conversions: "Conversies",
  cost: "Kosten",
  count: "Aantal",
  country: "Land",
  cpa: "Kosten per acquisitie",
  cpc: "Kosten per klik",
  ctr: "Klikratio",
  current: "Huidige periode",
  customerid: "Klantnummer",
  dailytrend: "Dagelijkse ontwikkeling",
  data: "Resultaat",
  date: "Datum",
  daterange: "Periode",
  daydata: "Resultaten per dag",
  dayname: "Dag",
  dayofweek: "Dagnummer",
  device: "Apparaat",
  devicecategory: "Apparaattype",
  dimensions: "Dimensies",
  duration: "Duur",
  ecommercepurchases: "Aankopen",
  enabled: "Ingeschakeld",
  engagementrate: "Betrokkenheidspercentage",
  engagementtime: "Betrokkenheidstijd",
  eventcount: "Aantal gebeurtenissen",
  eventname: "Gebeurtenis",
  events: "Gebeurtenissen",
  eventsersession: "Gebeurtenissen per sessie",
  eventspersession: "Gebeurtenissen per sessie",
  executivesummary: "Samenvatting voor de klant",
  firstusersource: "Eerste verkeersbron",
  firstusermedium: "Eerste medium",
  hostname: "Domein",
  impressions: "Vertoningen",
  insights: "Inzichten",
  itemcategory: "Productcategorie",
  itemname: "Product",
  items: "Onderdelen",
  language: "Taal",
  landingpage: "Landingspagina",
  landingpageplusquerystring: "Landingspagina",
  location: "Locatie",
  medium: "Medium",
  name: "Naam",
  newusers: "Nieuwe gebruikers",
  operatingystem: "Besturingssysteem",
  operatingsystem: "Besturingssysteem",
  organicusers: "Organische gebruikers",
  page: "Pagina",
  pages: "Pagina’s",
  pagetitle: "Paginatitel",
  pagepath: "Paginapad",
  pagepathplusquerystring: "Paginapad",
  pagesandscreens: "Pagina’s en schermen",
  pageviews: "Paginaweergaven",
  path: "Pad",
  position: "Gemiddelde positie",
  previous: "Vorige periode",
  productrevenue: "Productomzet",
  propertyname: "Propertynaam",
  purchases: "Aankopen",
  queries: "Zoekopdrachten",
  query: "Zoekopdracht",
  recommendations: "Aanbevelingen",
  report: "Rapportage",
  results: "Resultaten",
  revenue: "Omzet",
  roas: "Rendement op advertentiekosten",
  rows: "Resultaten",
  screenpageviews: "Paginaweergaven",
  screenpageviewspersession: "Paginaweergaven per sessie",
  sessions: "Sessies",
  sessionsource: "Verkeersbron",
  sessionsourcemedium: "Bron en medium",
  source: "Bron",
  status: "Status",
  success: "Geslaagd",
  summary: "Samenvatting",
  topchannels: "Belangrijkste kanalen",
  topcountries: "Belangrijkste landen",
  topdevices: "Apparaten",
  topevents: "Belangrijkste gebeurtenissen",
  toplandingpages: "Beste landingspagina’s",
  toppages: "Best bezochte pagina’s",
  toppagesbreakdown: "Best bezochte pagina’s",
  topsources: "Belangrijkste verkeersbronnen",
  total: "Totaal",
  totalrevenue: "Totale omzet",
  totalusers: "Gebruikers",
  trend: "Ontwikkeling",
  userengagementduration: "Totale betrokkenheidstijd",
  users: "Gebruikers",
  value: "Waarde",
  views: "Weergaven",
  visitors: "Bezoekers",
};

const NARRATIVE_KEYS = new Set([
  "analysis",
  "answer",
  "content",
  "executivesummary",
  "insights",
  "message",
  "recommendations",
  "summary",
  "text",
]);

const TECHNICAL_KEYS = new Set([
  "accountid",
  "dimensionheaders",
  "kind",
  "metadata",
  "metricheaders",
  "propertyid",
  "propertyquota",
  "rowcount",
  "success",
  "type",
]);

const normalizeKey = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, "").toLowerCase();

export const humanizeInzyteField = (value: string): string => {
  const normalized = normalizeKey(value);
  const translation = FIELD_LABELS[normalized];
  if (translation) return translation;
  const spaced = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  return spaced.replace(/^./, (character) => character.toUpperCase());
};

const numberFromString = (value: string): number | null => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const DUTCH_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatInzyteScalar = (value: unknown, field = ""): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  if (typeof value === "number") {
    return value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
  }
  if (typeof value !== "string") return JSON.stringify(value);

  if (/^\d{8}$/.test(value) && normalizeKey(field).includes("date")) {
    return `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
  }
  const parsedDate = Date.parse(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(parsedDate)) {
    return DUTCH_DATE_TIME_FORMATTER.format(new Date(parsedDate));
  }
  const numeric = numberFromString(value);
  if (numeric !== null) {
    return numeric.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
  }
  return value;
};

const headerNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) =>
          isInzyteRecord(item) && typeof item.name === "string"
            ? item.name
            : null,
        )
        .filter((item): item is string => Boolean(item))
    : [];

const cellValue = (value: unknown): unknown =>
  isInzyteRecord(value) && "value" in value ? value.value : value;

const normalizeGa4Rows = (value: InzyteJsonRecord): InzyteJsonRecord[] => {
  const dimensions = headerNames(value.dimensionHeaders);
  const metrics = headerNames(value.metricHeaders);
  if (!Array.isArray(value.rows) || dimensions.length + metrics.length === 0) {
    return [];
  }
  const normalizedRows: InzyteJsonRecord[] = [];
  for (const row of value.rows) {
    if (!isInzyteRecord(row)) continue;
    const normalized: InzyteJsonRecord = {};
    const dimensionValues = Array.isArray(row.dimensionValues)
      ? row.dimensionValues
      : [];
    const metricValues = Array.isArray(row.metricValues)
      ? row.metricValues
      : [];
    dimensions.forEach((name, index) => {
      normalized[name] = cellValue(dimensionValues[index]);
    });
    metrics.forEach((name, index) => {
      normalized[name] = cellValue(metricValues[index]);
    });
    normalizedRows.push(normalized);
  }
  return normalizedRows;
};

const scalarColumns = (rows: InzyteJsonRecord[]): string[] => {
  const keys = new Set<string>();
  rows.slice(0, 25).forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!isInzyteRecord(value) && !Array.isArray(value)) keys.add(key);
    });
  });
  return Array.from(keys).slice(0, 10);
};

const collectTables = (
  value: unknown,
  name = "Resultaten",
  path = "resultaten",
  depth = 0,
  output: InzytePresentationTable[] = [],
): InzytePresentationTable[] => {
  if (depth > 7 || output.length >= 10) return output;

  if (isInzyteRecord(value)) {
    const ga4Rows = normalizeGa4Rows(value);
    if (ga4Rows.length > 0) {
      output.push({
        key: path,
        title: humanizeInzyteField(name),
        columns: scalarColumns(ga4Rows),
        rows: ga4Rows.slice(0, 250),
      });
      Object.entries(value).forEach(([key, child]) => {
        if (!["dimensionHeaders", "metricHeaders", "rows"].includes(key)) {
          collectTables(child, key, `${path}.${key}`, depth + 1, output);
        }
      });
      return output;
    }

    Object.entries(value).forEach(([key, child]) => {
      if (!TECHNICAL_KEYS.has(normalizeKey(key))) {
        collectTables(child, key, `${path}.${key}`, depth + 1, output);
      }
    });
    return output;
  }

  if (!Array.isArray(value)) return output;
  const rows = value.filter(isInzyteRecord).slice(0, 250);
  const columns = scalarColumns(rows);
  if (rows.length > 0 && columns.length > 0) {
    output.push({
      key: path,
      title: humanizeInzyteField(name),
      columns,
      rows,
    });
  }
  return output;
};

const findKpis = (value: unknown, depth = 0): InzyteJsonRecord | null => {
  if (depth > 6 || !isInzyteRecord(value)) return null;
  if (isInzyteRecord(value.kpis)) return value.kpis;
  for (const child of Object.values(value)) {
    const found = findKpis(child, depth + 1);
    if (found) return found;
  }
  return null;
};

const collectNarratives = (
  value: unknown,
  name = "Samenvatting",
  depth = 0,
  output: InzytePresentationNarrative[] = [],
): InzytePresentationNarrative[] => {
  if (depth > 6 || output.length >= 6) return output;
  if (typeof value === "string" && value.trim().length >= 40) {
    output.push({ title: humanizeInzyteField(name), text: value.trim() });
    return output;
  }
  if (!isInzyteRecord(value)) return output;
  Object.entries(value).forEach(([key, child]) => {
    const normalized = normalizeKey(key);
    if (
      typeof child === "string" &&
      child.trim().length >= 40 &&
      (NARRATIVE_KEYS.has(normalized) || child.includes("\n"))
    ) {
      output.push({
        title: humanizeInzyteField(key),
        text: child.trim(),
      });
      return;
    }
    if (isInzyteRecord(child)) {
      collectNarratives(child, key, depth + 1, output);
    }
  });
  return output;
};

export const buildInzytePresentation = (data: unknown): InzytePresentation => {
  const unwrapped = unwrapInzyteData(data);
  const kpis = findKpis(unwrapped);
  const metrics: InzytePresentationMetric[] = kpis
    ? Object.entries(kpis)
        .slice(0, 12)
        .map(([key, raw]) => ({
          key,
          label: humanizeInzyteField(key),
          value: isInzyteRecord(raw) && "current" in raw ? raw.current : raw,
          delta:
            isInzyteRecord(raw) && typeof raw.deltaPct === "number"
              ? raw.deltaPct
              : null,
        }))
    : [];
  const narratives = collectNarratives(unwrapped);
  const narrativeKeys = new Set(
    narratives.map((item) => normalizeKey(item.title)),
  );
  const scalars = isInzyteRecord(unwrapped)
    ? Object.entries(unwrapped)
        .filter(([key, value]) => {
          const normalized = normalizeKey(key);
          return (
            !TECHNICAL_KEYS.has(normalized) &&
            !NARRATIVE_KEYS.has(normalized) &&
            !narrativeKeys.has(normalized) &&
            !isInzyteRecord(value) &&
            !Array.isArray(value)
          );
        })
        .slice(0, 12)
        .map(([key, value]) => ({
          key,
          label: humanizeInzyteField(key),
          value,
        }))
    : [];

  return {
    metrics,
    narratives:
      typeof unwrapped === "string" && narratives.length === 0
        ? [{ title: "Samenvatting", text: unwrapped }]
        : narratives,
    scalars,
    tables: collectTables(unwrapped),
  };
};

export const buildClientUpdateText = ({
  data,
  title,
  actionLabel,
  completedAt,
  startDate,
  endDate,
}: {
  data: unknown;
  title: string;
  actionLabel: string;
  completedAt: string;
  startDate?: string;
  endDate?: string;
}): string => {
  const presentation = buildInzytePresentation(data);
  const lines = [
    `${actionLabel} — ${title}`,
    `Bijgewerkt op ${new Date(completedAt).toLocaleString("nl-NL")}`,
    startDate && endDate ? `Analyseperiode: ${startDate} t/m ${endDate}` : "",
  ].filter(Boolean);

  if (presentation.metrics.length > 0) {
    lines.push(
      "",
      "Kerncijfers",
      ...presentation.metrics.map(
        (metric) =>
          `- ${metric.label}: ${formatInzyteScalar(metric.value, metric.key)}${
            metric.delta === null
              ? ""
              : ` (${metric.delta > 0 ? "+" : ""}${metric.delta.toLocaleString(
                  "nl-NL",
                )}% ten opzichte van de vorige periode)`
          }`,
      ),
    );
  }

  presentation.narratives.forEach((narrative) => {
    lines.push("", narrative.title, narrative.text);
  });

  presentation.tables.slice(0, 3).forEach((table) => {
    lines.push("", table.title);
    table.rows.slice(0, 5).forEach((row) => {
      lines.push(
        `- ${table.columns
          .slice(0, 4)
          .map(
            (column) =>
              `${humanizeInzyteField(column)}: ${formatInzyteScalar(
                row[column],
                column,
              )}`,
          )
          .join(" · ")}`,
      );
    });
  });

  return lines.join("\n").slice(0, 20_000);
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const buildInzytePrintDocument = ({
  data,
  title,
  actionLabel,
  completedAt,
  startDate,
  endDate,
}: {
  data: unknown;
  title: string;
  actionLabel: string;
  completedAt: string;
  startDate?: string;
  endDate?: string;
}): string => {
  const presentation = buildInzytePresentation(data);
  const metrics = presentation.metrics
    .map(
      (metric) =>
        `<div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(
          formatInzyteScalar(metric.value, metric.key),
        )}</strong>${
          metric.delta === null
            ? ""
            : `<small class="${metric.delta >= 0 ? "up" : "down"}">${
                metric.delta > 0 ? "+" : ""
              }${escapeHtml(metric.delta.toLocaleString("nl-NL"))}% t.o.v. vorige periode</small>`
        }</div>`,
    )
    .join("");
  const narratives = presentation.narratives
    .map(
      (narrative) =>
        `<section><h2>${escapeHtml(narrative.title)}</h2><div class="narrative">${escapeHtml(
          narrative.text,
        ).replaceAll("\n", "<br>")}</div></section>`,
    )
    .join("");
  const tables = presentation.tables
    .slice(0, 6)
    .map((table) => {
      const columns = table.columns.slice(0, 7);
      const header = columns
        .map((column) => `<th>${escapeHtml(humanizeInzyteField(column))}</th>`)
        .join("");
      const rows = table.rows
        .slice(0, 30)
        .map(
          (row) =>
            `<tr>${columns
              .map(
                (column) =>
                  `<td>${escapeHtml(
                    formatInzyteScalar(row[column], column),
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      return `<section class="table-section"><h2>${escapeHtml(
        table.title,
      )}</h2><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></section>`;
    })
    .join("");
  const scalarCards = presentation.scalars
    .map(
      (item) =>
        `<div class="metric"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(
          formatInzyteScalar(item.value, item.key),
        )}</strong></div>`,
    )
    .join("");
  const empty =
    !metrics && !narratives && !tables && !scalarCards
      ? '<p class="empty">Voor dit onderdeel zijn geen presenteerbare resultaten ontvangen.</p>'
      : "";

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(
    `${actionLabel} · ${title}`,
  )}</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#fff}
  *{box-sizing:border-box}body{margin:0;padding:42px;line-height:1.55}.report{max-width:1120px;margin:0 auto}
  header{border-bottom:3px solid #2185ff;padding-bottom:22px;margin-bottom:28px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2185ff}
  h1{font-size:30px;line-height:1.15;margin:8px 0 10px}h2{font-size:19px;margin:0 0 12px}.meta{color:#667085;font-size:13px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0}
  .metric{border:1px solid #e1e5eb;border-radius:12px;padding:14px;break-inside:avoid}.metric span{display:block;color:#667085;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}.metric strong{display:block;font-size:22px;margin-top:4px}.metric small{display:block;margin-top:6px}.up{color:#087f5b}.down{color:#c92a2a}
  section{margin:28px 0;break-inside:avoid}.narrative{border-left:4px solid #2185ff;background:#f5f9ff;border-radius:0 12px 12px 0;padding:18px;white-space:normal}
  table{width:100%;border-collapse:collapse;font-size:11px}th{background:#172033;color:#fff;text-align:left}th,td{padding:9px 10px;border:1px solid #dfe3e8;vertical-align:top}tbody tr:nth-child(even){background:#f7f8fa}.empty{padding:24px;background:#f7f8fa;border-radius:12px}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid #e1e5eb;color:#667085;font-size:11px}
  @page{size:A4 landscape;margin:14mm}@media print{body{padding:0}.report{max-width:none}.table-section{break-inside:auto}thead{display:table-header-group}}
  @media(max-width:760px){body{padding:20px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style></head><body><main class="report"><header><div class="eyebrow">Marketingbende · klantupdate</div><h1>${escapeHtml(
    title,
  )}</h1><div class="meta">${escapeHtml(actionLabel)} · bijgewerkt op ${escapeHtml(
    new Date(completedAt).toLocaleString("nl-NL"),
  )}${
    startDate && endDate
      ? ` · analyseperiode ${escapeHtml(startDate)} t/m ${escapeHtml(endDate)}`
      : ""
  }</div></header>${
    metrics || scalarCards
      ? `<div class="metrics">${metrics}${scalarCards}</div>`
      : ""
  }${narratives}${tables}${empty}<footer>Opgesteld door Marketingbende. Controleer de conclusies vóór verzending aan de klant.</footer></main><script>window.addEventListener("load",()=>window.print())</script></body></html>`;
};
