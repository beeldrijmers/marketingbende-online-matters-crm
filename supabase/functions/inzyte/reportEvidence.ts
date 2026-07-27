import type {
  MonthlyHeadlineMetric,
  MonthlyReportPeriod,
} from "./monthlyReport.ts";

export type ReportEvidenceKind =
  | "assignment"
  | "completed_work"
  | "card_comment"
  | "sent_email"
  | "note";

export type ReportEvidenceItem = {
  id: string;
  kind: ReportEvidenceKind;
  date: string | null;
  title: string;
  excerpt: string;
  currentPeriod: boolean;
};

export type ReportEvidenceCounts = {
  assignment: number;
  completedWork: number;
  cardComments: number;
  sentEmails: number;
  otherNotes: number;
};

export type ReportEvidenceBundle = {
  items: ReportEvidenceItem[];
  current: ReportEvidenceItem[];
  allTime: ReportEvidenceItem[];
  currentCounts: ReportEvidenceCounts;
  allTimeCounts: ReportEvidenceCounts;
  /** @deprecated Kept for reports generated before current/all-time counts split. */
  counts: ReportEvidenceCounts;
  gmailStatus: "connected" | "not_connected" | "no_match" | "failed";
};

export type ReportNarrative = {
  clientSummary: string;
  interpretation: string;
  workSummary: string;
  caveats: string;
  nextSteps: string;
  generatedBy: "evidence_rules" | "inzyte_ai";
};

type WorkInput = {
  id?: unknown;
  task_text?: unknown;
  completed_at?: unknown;
};

type NoteInput = {
  id?: unknown;
  text?: unknown;
  date?: unknown;
  activity_source?: unknown;
  source_event_id?: unknown;
  type?: unknown;
};

export type SentMailInput = {
  id: string;
  subject: string;
  date: string;
  text: string;
};

const INTERNAL_TERMS = [
  [/\bCRM\s*\+\s*Inzyte\b/gi, "Online Matters"],
  [/\bInzyte(?:\.io)?\b/gi, "het analyseplatform"],
  [/\bTrello\b/gi, "het werkzaamhedenoverzicht"],
  [/\bGmail\b/gi, "de correspondentie"],
  [/\bCRM\b/gi, "het klantdossier"],
  [/\bMarketingbende\b/gi, "Online Matters"],
] as const;

const CREDENTIAL_BLOCK_LABEL =
  /^\s*(?:inlog(?:gegevens)?|login(?:gegevens)?|credentials?|auth(?:enticatie)?|wp[- ]?admin)(?:\s+[^:\n]{0,50})?\s*:\s*$/i;
const CREDENTIAL_VALUE_LABEL =
  /^\s*(?:inlog(?:gegevens)?|login|gebruikersnaam|user(?:name)?|wachtwoord|password|api[- _]?key|secret|token|wp[- ]?admin)\s*:\s*\S+/i;
const SECRETISH_VALUE =
  /^(?=.{10,180}$)(?=\S+$)(?=.*[a-z])(?=.*(?:\d|[^a-z0-9])).+$/i;
const EMAIL_ADDRESS = /\b[\w.+%-]+@[\w.-]+\.[a-z]{2,}\b/gi;
const INTERNAL_URL =
  /https?:\/\/(?:crm\.marketingbende\.nl|trello\.com|inzyte\.io)\S*/gi;
const REPORT_NOTE_ID = /^seo-monthly-report:/i;
const REPORT_MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  timeZone: "UTC",
});

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const asDate = (value: unknown): string | null => {
  const text = asText(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

const withinPeriod = (
  value: string | null,
  period: MonthlyReportPeriod,
  graceDays = 0,
): boolean => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const start = Date.parse(`${period.currentStart}T00:00:00.000Z`);
  const end = Date.parse(`${period.currentEnd}T23:59:59.999Z`);
  return (
    Number.isFinite(timestamp) &&
    timestamp >= start &&
    timestamp <= end + graceDays * 86_400_000
  );
};

const mailReferencesReportingMonth = (
  message: Pick<SentMailInput, "subject" | "text">,
  period: MonthlyReportPeriod,
): boolean => {
  const monthDate = new Date(
    `${period.reportingMonth.slice(0, 7)}-01T00:00:00Z`,
  );
  const monthName = REPORT_MONTH_FORMATTER.format(monthDate);
  const year = String(monthDate.getUTCFullYear());
  const monthNumber = String(monthDate.getUTCMonth() + 1).padStart(2, "0");
  const content = `${message.subject}\n${message.text}`.toLocaleLowerCase(
    "nl-NL",
  );
  return (
    content.includes(`${monthName} ${year}`) ||
    content.includes(`update ${monthName}`) ||
    content.includes(`rapportage ${monthName}`) ||
    content.includes(`${year}-${monthNumber}`) ||
    content.includes(`${monthNumber}-${year}`) ||
    content.includes(`${monthNumber}/${year}`)
  );
};

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

/**
 * Makes operational source text safe to use in a customer narrative prompt.
 * Credentials and internal URLs are removed before any external AI call.
 */
export const sanitizeReportEvidenceText = (
  value: string,
  maxLength = 2_500,
): string => {
  let text = stripHtml(value)
    .replace(/^\[Trello\s*-\s*[^\]]+\]\s*/i, "")
    .replace(INTERNAL_URL, "")
    .replace(EMAIL_ADDRESS, "[e-mailadres]")
    .replace(/\[trello-bijlage:[^\]]+\]/gi, "");
  for (const [pattern, replacement] of INTERNAL_TERMS) {
    text = text.replace(pattern, replacement);
  }

  const safeLines: string[] = [];
  let skipSensitiveLines = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (skipSensitiveLines > 0) {
      skipSensitiveLines -= 1;
      continue;
    }
    if (CREDENTIAL_BLOCK_LABEL.test(line)) {
      skipSensitiveLines = 3;
      continue;
    }
    if (CREDENTIAL_VALUE_LABEL.test(line)) continue;
    if (SECRETISH_VALUE.test(line) && !/^https?:\/\//i.test(line)) continue;
    if (/^bron\s*\([^)]*\)\s*:/i.test(line)) continue;
    if (/^op .+ schreef .+:$/i.test(line)) break;
    safeLines.push(line);
  }

  return safeLines
    .join("\n")
    .replace(/@[a-z0-9._-]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, maxLength);
};

const uniqueEvidence = (items: ReportEvidenceItem[]): ReportEvidenceItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.excerpt
      .toLocaleLowerCase("nl-NL")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const noteKind = (note: NoteInput): ReportEvidenceKind => {
  if (note.activity_source === "trello") return "card_comment";
  if (/^gmail:/i.test(asText(note.source_event_id))) return "sent_email";
  return "note";
};

const countEvidence = (items: ReportEvidenceItem[]): ReportEvidenceCounts =>
  items.reduce<ReportEvidenceCounts>(
    (result, item) => {
      if (item.kind === "assignment") result.assignment += 1;
      if (item.kind === "completed_work") result.completedWork += 1;
      if (item.kind === "card_comment") result.cardComments += 1;
      if (item.kind === "sent_email") result.sentEmails += 1;
      if (item.kind === "note") result.otherNotes += 1;
      return result;
    },
    {
      assignment: 0,
      completedWork: 0,
      cardComments: 0,
      sentEmails: 0,
      otherNotes: 0,
    },
  );

export const buildReportEvidence = ({
  assignmentDescription,
  currentWork,
  allTimeWork,
  currentNotes,
  allTimeNotes,
  sentMail,
  gmailStatus,
  period,
}: {
  assignmentDescription: string | null;
  currentWork: WorkInput[];
  allTimeWork: WorkInput[];
  currentNotes: NoteInput[];
  allTimeNotes: NoteInput[];
  sentMail: SentMailInput[];
  gmailStatus: ReportEvidenceBundle["gmailStatus"];
  period: MonthlyReportPeriod;
}): ReportEvidenceBundle => {
  const items: ReportEvidenceItem[] = [];
  const assignment = sanitizeReportEvidenceText(
    assignmentDescription || "",
    4_000,
  );
  if (assignment) {
    items.push({
      id: "assignment",
      kind: "assignment",
      date: null,
      title: "Opdrachtomschrijving",
      excerpt: assignment,
      currentPeriod: false,
    });
  }

  const currentWorkIds = new Set(
    currentWork.map((item) => String(item.id || "")),
  );
  for (const item of allTimeWork) {
    const excerpt = sanitizeReportEvidenceText(asText(item.task_text), 1_000);
    if (!excerpt) continue;
    const date = asDate(item.completed_at);
    items.push({
      id: `work:${String(item.id || excerpt)}`,
      kind: "completed_work",
      date,
      title: "Afgeronde werkzaamheid",
      excerpt,
      currentPeriod:
        currentWorkIds.has(String(item.id || "")) || withinPeriod(date, period),
    });
  }

  const currentNoteIds = new Set(
    currentNotes.map((note) => String(note.id || "")),
  );
  for (const note of allTimeNotes) {
    if (REPORT_NOTE_ID.test(asText(note.source_event_id))) continue;
    const excerpt = sanitizeReportEvidenceText(asText(note.text), 2_000);
    if (!excerpt) continue;
    const date = asDate(note.date);
    const kind = noteKind(note);
    items.push({
      id: `note:${String(note.id || note.source_event_id || excerpt)}`,
      kind,
      date,
      title:
        kind === "card_comment"
          ? "Kaartopmerking"
          : kind === "sent_email"
            ? "Gekoppelde e-mail"
            : asText(note.type) || "Voortgangsnotitie",
      excerpt,
      currentPeriod:
        currentNoteIds.has(String(note.id || "")) || withinPeriod(date, period),
    });
  }

  for (const message of sentMail) {
    const body = sanitizeReportEvidenceText(message.text, 2_000);
    const subject = sanitizeReportEvidenceText(message.subject, 240);
    const excerpt = [subject, body].filter(Boolean).join("\n\n");
    if (!excerpt) continue;
    const date = asDate(message.date);
    const currentPeriod =
      withinPeriod(date, period) ||
      (withinPeriod(date, period, 21) &&
        mailReferencesReportingMonth(message, period));
    items.push({
      id: `mail:${message.id}`,
      kind: "sent_email",
      date,
      title: subject || "Verzonden e-mail",
      excerpt,
      // A status update sent after month-end only counts for the reporting
      // month when it explicitly names that month. This prevents new work from
      // the following month being presented as older work.
      currentPeriod,
    });
  }

  const deduped = uniqueEvidence(items).sort((left, right) =>
    String(right.date || "").localeCompare(String(left.date || "")),
  );
  const current = deduped.filter((item) => item.currentPeriod);
  const currentCounts = countEvidence(current);
  const allTimeCounts = countEvidence(deduped);

  return {
    items: deduped,
    current,
    allTime: deduped,
    currentCounts,
    allTimeCounts,
    counts: allTimeCounts,
    gmailStatus,
  };
};

const formatMetric = (metric: MonthlyHeadlineMetric, value: number): string =>
  metric.format === "percent"
    ? `${value.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`
    : value.toLocaleString("nl-NL", {
        maximumFractionDigits: metric.format === "decimal" ? 1 : 0,
      });

const changeText = (metric: MonthlyHeadlineMetric): string => {
  if (metric.changePercent === null) return "een nieuw meetpunt";
  const absolute = Math.abs(metric.changePercent).toLocaleString("nl-NL", {
    maximumFractionDigits: 1,
  });
  if (metric.key === "position") {
    return metric.favourable === true
      ? `${absolute}% gunstiger`
      : metric.favourable === false
        ? `${absolute}% minder gunstig`
        : "vrijwel stabiel";
  }
  return `${metric.changePercent >= 0 ? "+" : "-"}${absolute}%`;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthLabel = (date: string): string =>
  MONTH_FORMATTER.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));

/**
 * Platte-tekstmail is hard afgebroken, meestal rond de tweeënzeventig tekens.
 * Elk regeleinde als zinseinde lezen levert dan halve zinnen op, en die kwamen
 * zo in een klantrapportage terecht:
 *
 *   "de website rond hellende daken en pannendaken verder op te bouwen."
 *   "We hebben 15 nieuwe landingspagina's gepubliceerd: 12."
 *
 * Een regel die niet op leesteken eindigt en wordt gevolgd door een regel die
 * met kleine letter of cijfer begint, is geen alinea maar een doorloop. Lijsten
 * en koppen blijven wel gescheiden: die beginnen met een streepje, een bolletje
 * of een hoofdletter.
 */
export const unwrapHardBreaks = (text: string): string =>
  text.replace(/([^\s.!?])[ \t]*\n[ \t]*(?=[a-z0-9(])/g, "$1 ");

/** Markdown-nadruk hoort niet in een zin die een klant leest. */
const stripEmphasis = (line: string): string =>
  line
    .replace(/\*+/g, "")
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2")
    .trim();

const evidenceLines = (item: ReportEvidenceItem, pattern: RegExp): string[] =>
  unwrapHardBreaks(item.excerpt)
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) =>
      stripEmphasis(
        line
          .replace(/^[-*•\d.)\s]+/, "")
          .replace(/^#+\s*/, "")
          .trim(),
      ),
    )
    .filter((line) => line.length >= 18 && line.length <= 360)
    // Begint hij na dat alles nog met een kleine letter, dan ontbreekt het begin
    // van de zin. Aanvullen kan niet, dus dan is weglaten eerlijker dan een
    // regel die halverwege begint.
    .filter((line) => !/^[a-z]/.test(line))
    .filter((line) => pattern.test(line));

const uniqueBullets = (values: string[], maximum: number): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = sanitizeReportEvidenceText(value, 360)
      .replace(/[.;:,]+$/, "")
      .trim();
    const key = cleaned.toLocaleLowerCase("nl-NL");
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(`• ${cleaned}.`);
    if (result.length >= maximum) break;
  }
  return result;
};

const COMPLETED_PATTERN =
  /\b(?:afgerond|aangepast|aangescherpt|gebouwd|gecontroleerd|gecorrigeerd|geïndexeerd|geoptimaliseerd|gepubliceerd|gerepareerd|geschreven|hersteld|ingediend|live gezet|opgeleverd|toegevoegd|uitgevoerd|verholpen|vernieuwd)\b/i;
const FUTURE_PATTERN =
  /\b(?:aanbevel|blijven monitoren|komende maand|komende periode|daarna|focus|gaan we|inplannen|monitoren|oppakken|uitbreiden|verder|vervolg|zodra)\b/i;
const CAVEAT_PATTERN =
  /\b(?:aandacht|afhankelijk|blokkeer|bug|externe|historisch|kan nog|kritiek|niet|nog geen|onvolledig|risico|spam|wacht|zorgpunt)\b/i;

export const buildDefaultReportNarrative = ({
  companyName,
  period,
  metrics,
  evidence,
}: {
  companyName: string;
  period: MonthlyReportPeriod;
  metrics: MonthlyHeadlineMetric[];
  evidence: ReportEvidenceBundle;
}): ReportNarrative => {
  const hasMetrics = metrics.length > 0;
  const comparable = metrics.filter((metric) => metric.changePercent !== null);
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
  const currentWork = evidence.current.filter(
    (item) => item.kind === "completed_work",
  );
  const currentSourceCount = evidence.current.filter(
    (item) => item.kind !== "assignment",
  ).length;

  const summary: string[] = hasMetrics
    ? [
        `In ${monthLabel(period.reportingMonth)} hebben we voor ${companyName} verder gewerkt aan de afgesproken digitale doelen. Deze update combineert gecontroleerde meetgegevens met ${currentSourceCount} relevante voortgangsbron${currentSourceCount === 1 ? "" : "nen"} uit de opdracht.`,
      ]
    : [
        `In ${monthLabel(period.reportingMonth)} hebben we de voortgang voor ${companyName} in kaart gebracht op basis van ${currentSourceCount} relevante voortgangsbron${currentSourceCount === 1 ? "" : "nen"} uit de opdracht. Er was geen volledige gecontroleerde meetreeks beschikbaar; deze update gaat daarom over aantoonbaar uitgevoerd werk en voortgang, niet over verkeers- of rankingresultaten.`,
      ];
  if (favourable) {
    summary.push(
      `De duidelijkste positieve ontwikkeling zien we bij ${favourable.label.toLocaleLowerCase("nl-NL")}: ${formatMetric(favourable, favourable.current)}, oftewel ${changeText(favourable)} ten opzichte van de vorige maand.`,
    );
  } else if (metrics.length > 0) {
    summary.push(
      "De belangrijkste meetpunten zijn beschikbaar en geven een bruikbaar vertrekpunt om de komende maand gericht op voort te bouwen.",
    );
  }
  if (currentWork.length > 0) {
    summary.push(
      `${currentWork.length} concrete werkzaamhe${currentWork.length === 1 ? "id is" : "den zijn"} deze rapportagemaand als afgerond vastgelegd.`,
    );
  }
  if (attention) {
    summary.push(
      `Tegelijk vraagt ${attention.label.toLocaleLowerCase("nl-NL")} aandacht; dit meetpunt ontwikkelde zich ${changeText(attention)}. Dat nemen we mee in de prioriteiten voor de komende maand.`,
    );
  }

  const interpretation = hasMetrics
    ? [
        favourable
          ? `De stijging bij ${favourable.label.toLocaleLowerCase("nl-NL")} laat zien dat de digitale prestaties in deze periode op dit onderdeel gunstiger waren.`
          : "De beschikbare cijfers geven een bruikbaar meetbeeld waarop verder kan worden geoptimaliseerd.",
        attention
          ? `De minder gunstige ontwikkeling bij ${attention.label.toLocaleLowerCase("nl-NL")} betekent dat we gericht controleren waar bereik, relevantie, doorklik of conversie mogelijk achterblijft.`
          : "Binnen de beschikbare kerncijfers is in deze vergelijking geen afzonderlijke duidelijke terugval aangemerkt.",
        "We koppelen deze ontwikkeling aan het uitgevoerde werk als onderbouwing, niet als bewijs dat één wijziging het volledige resultaat heeft veroorzaakt.",
      ].join(" ")
    : "Deze rapportage laat zien welke werkzaamheden en voortgang aantoonbaar zijn vastgelegd. Zonder een volledige gecontroleerde meetreeks kunnen we daar nog geen betrouwbare conclusie over verkeer, vindbaarheid, advertenties of conversies aan verbinden.";

  const completedLines = currentWork.map((item) => item.excerpt);
  const sourceCompletedLines = evidence.current.flatMap((item) =>
    evidenceLines(item, COMPLETED_PATTERN),
  );
  const workBullets = uniqueBullets(
    [...completedLines, ...sourceCompletedLines],
    10,
  );
  const workSummary =
    workBullets.length > 0
      ? workBullets.join("\n")
      : "De uitgevoerde werkzaamheden zijn nog niet concreet genoeg vastgelegd om ze verantwoord aan de klant te rapporteren.";

  const caveatLines = evidence.current.flatMap((item) =>
    evidenceLines(item, CAVEAT_PATTERN),
  );
  const caveats = uniqueBullets(
    [
      ...(attention
        ? [
            `${attention.label} ontwikkelde zich ${changeText(attention)} en blijft daarom een actief aandachtspunt`,
          ]
        : []),
      ...caveatLines,
      ...(hasMetrics
        ? [
            "Een maand-op-maandvergelijking blijft gevoelig voor seizoen, campagnes, concurrentie en wijzigingen buiten de uitgevoerde werkzaamheden",
          ]
        : [
            "Er was geen volledige gecontroleerde maand-op-maandmeting beschikbaar; uitspraken over effect op verkeer, vindbaarheid, advertenties of conversies zijn daarom niet verantwoord",
          ]),
    ],
    4,
  ).join("\n");

  const futureLines = evidence.current.flatMap((item) =>
    evidenceLines(item, FUTURE_PATTERN),
  );
  const nextSteps = uniqueBullets(
    [
      ...futureLines,
      ...(attention
        ? [
            `De ontwikkeling van ${attention.label.toLocaleLowerCase("nl-NL")} gericht volgen en de onderliggende zoekopdrachten en pagina's controleren`,
          ]
        : []),
      ...(hasMetrics
        ? [
            "De belangrijkste kerncijfers opnieuw vergelijken zodra de volgende kalendermaand volledig meetbaar is",
          ]
        : [
            "Werkzaamheden en klantbesluiten consequent blijven vastleggen voor de volgende maandupdate",
            "Indien gewenst een relevante meetbron controleren zodat een volgende rapportage ook meetresultaten kan bevatten",
          ]),
    ],
    5,
  ).join("\n");

  return {
    clientSummary: summary.join("\n\n"),
    interpretation,
    workSummary,
    caveats,
    nextSteps,
    generatedBy: "evidence_rules",
  };
};

const narrativeCandidate = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of [
    "answer",
    "content",
    "text",
    "message",
    "response",
    "data",
  ]) {
    const found = narrativeCandidate(record[key]);
    if (found) return found;
  }
  return null;
};

const readNarrativeJson = (value: string): Record<string, unknown> | null => {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const safeNarrativeField = (
  value: unknown,
  fallback: string,
  minimum: number,
): string => {
  const sanitized = sanitizeReportEvidenceText(asText(value), 12_000);
  return sanitized.length >= minimum ? sanitized : fallback;
};

export const mergeInzyteNarrative = (
  response: unknown,
  fallback: ReportNarrative,
): ReportNarrative => {
  const candidate = narrativeCandidate(response);
  const parsed = candidate ? readNarrativeJson(candidate) : null;
  if (!parsed) return fallback;
  return {
    clientSummary: safeNarrativeField(
      parsed.clientSummary,
      fallback.clientSummary,
      80,
    ),
    interpretation: safeNarrativeField(
      parsed.interpretation,
      fallback.interpretation,
      50,
    ),
    workSummary: safeNarrativeField(
      parsed.workSummary,
      fallback.workSummary,
      30,
    ),
    caveats: safeNarrativeField(parsed.caveats, fallback.caveats, 30),
    nextSteps: safeNarrativeField(parsed.nextSteps, fallback.nextSteps, 30),
    generatedBy: "inzyte_ai",
  };
};

const METRIC_TOPIC_REQUIREMENTS: Array<{
  pattern: RegExp;
  keys?: string[];
  group?: MonthlyHeadlineMetric["group"];
}> = [
  {
    pattern: /\b(?:organische\s+)?sessies?\b/i,
    keys: ["organicSessions", "sessions"],
  },
  {
    pattern: /\b(?:(?:actieve\s+)?gebruikers?|bezoekers?)\b/i,
    keys: ["activeUsers"],
  },
  {
    pattern: /\bverkeer\b/i,
    keys: ["organicSessions", "sessions", "activeUsers"],
  },
  {
    pattern: /\b(?:klikratio|ctr)\b/i,
    keys: ["ctr"],
  },
  {
    pattern: /\b(?:klikken?)\b/i,
    keys: [
      "clicks",
      "adsClicks",
      "businessProfileWebsiteClicks",
      "businessProfileCalls",
    ],
  },
  {
    pattern: /\b(?:vertoningen?)\b/i,
    keys: ["impressions", "adsImpressions", "businessProfileViews"],
  },
  {
    pattern: /\b(?:conversies?|key events?)\b/i,
    keys: ["conversions", "adsConversions"],
  },
  {
    pattern: /\b(?:(?:gemiddelde\s+)?positie|rankings?)\b/i,
    keys: ["position"],
  },
  {
    pattern: /\b(?:advertenties?|campagneprestaties?)\b/i,
    group: "ads",
  },
  {
    pattern: /\b(?:bedrijfsprofiel|maps|routeaanvragen?|belacties?)\b/i,
    group: "local",
  },
  {
    pattern: /\bvindbaarheid\b/i,
    group: "seo",
  },
];

const metricNumberMatches = (claim: number, values: number[]): boolean =>
  values.some((value) => Math.abs(value - claim) < 0.11);

const metricsForRequirement = (
  requirement: (typeof METRIC_TOPIC_REQUIREMENTS)[number],
  metrics: MonthlyHeadlineMetric[],
): MonthlyHeadlineMetric[] => {
  if (requirement.group) {
    return metrics.filter((metric) => metric.group === requirement.group);
  }
  const requiredKeys = new Set(requirement.keys || []);
  return metrics.filter((metric) => requiredKeys.has(metric.key));
};

/**
 * Rejects polished AI copy when it introduces a metric topic or percentage
 * that is absent from the normalized, verified month comparison. The
 * deterministic evidence narrative remains the safe fallback.
 */
export const isNarrativeSupportedByMetrics = (
  narrative: ReportNarrative,
  metrics: MonthlyHeadlineMetric[],
): boolean => {
  const text = [
    narrative.clientSummary,
    narrative.interpretation,
    narrative.workSummary,
    narrative.caveats,
    narrative.nextSteps,
  ].join("\n");

  for (const requirement of METRIC_TOPIC_REQUIREMENTS) {
    if (!requirement.pattern.test(text)) continue;
    const supportingMetrics = metricsForRequirement(requirement, metrics);
    if (supportingMetrics.length === 0) return false;

    const allowedValues = supportingMetrics.flatMap((metric) => [
      Math.abs(metric.current),
      Math.abs(metric.previous),
      Math.abs(metric.change),
    ]);
    const relatedClaims = text
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((sentence) => requirement.pattern.test(sentence))
      .flatMap((sentence) =>
        Array.from(
          sentence
            .replace(/-?\d+(?:[.,]\d+)?\s*%/g, "")
            .matchAll(/-?\d+(?:[.,]\d+)?/g),
          (match) => Math.abs(Number(match[0].replace(",", "."))),
        ),
      )
      .filter(Number.isFinite);
    if (
      relatedClaims.some((claim) => !metricNumberMatches(claim, allowedValues))
    ) {
      return false;
    }
  }

  const allowedPercentages = metrics.flatMap((metric) => [
    ...(metric.format === "percent" ? [metric.current, metric.previous] : []),
    ...(metric.changePercent === null ? [] : [Math.abs(metric.changePercent)]),
  ]);
  const percentageClaims = Array.from(
    text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*%/g),
    (match) => Math.abs(Number(match[1].replace(",", "."))),
  ).filter(Number.isFinite);

  return percentageClaims.every((claim) =>
    metricNumberMatches(claim, allowedPercentages),
  );
};

export const buildNarrativePromptContext = ({
  companyName,
  period,
  metrics,
  evidence,
}: {
  companyName: string;
  period: MonthlyReportPeriod;
  metrics: MonthlyHeadlineMetric[];
  evidence: ReportEvidenceBundle;
}): string =>
  JSON.stringify({
    klant: companyName,
    rapportagemaand: period.reportingMonth,
    vergelijking: {
      huidig: [period.currentStart, period.currentEnd],
      vorig: [period.previousStart, period.previousEnd],
    },
    kerncijfers: metrics.map((metric) => ({
      naam: metric.label,
      huidig: metric.current,
      vorig: metric.previous,
      veranderingProcent: metric.changePercent,
      gunstig: metric.favourable,
      definitie: metric.definition,
    })),
    huidigeMaand: evidence.current.slice(0, 35).map((item) => ({
      soort: item.kind,
      datum: item.date,
      tekst: item.excerpt.slice(0, 900),
    })),
    voorgeschiedenis: evidence.allTime.slice(0, 45).map((item) => ({
      soort: item.kind,
      datum: item.date,
      tekst: item.excerpt.slice(0, 550),
    })),
    bronTellingen: {
      rapportagemaand: evidence.currentCounts,
      volledigDossier: evidence.allTimeCounts,
    },
  }).slice(0, 28_000);

export const MONTHLY_NARRATIVE_QUESTION = `Schrijf op basis van het aangeleverde bronmateriaal een klantklare Nederlandse maandupdate in de toon van een persoonlijke, deskundige statusmail. Gebruik uitsluitend aantoonbare feiten uit het bronmateriaal. De uitgevoerde werkzaamheden en vastgelegde voortgang vormen altijd de basis. Gebruik meetcijfers alleen als ze werkelijk zijn aangeleverd; zonder cijfers mag je geen groei, stabiliteit, verkeers-, advertentie-, conversie- of rankingresultaat suggereren. Formuleer positief waar de feiten dat toelaten, benoem minder gunstige ontwikkelingen en onzekerheden eerlijk, en eindig met concreet toekomstperspectief. Maak geen oorzakelijke claims die niet zijn bewezen. Noem geen interne systemen, kaartsoftware, mailboxsoftware, CRM of analyseplatform. Neem werkzaamheden uit de rapportagemaand op; gebruik oudere informatie alleen als relevante context. Geef uitsluitend geldige JSON terug met exact deze velden: {"clientSummary":"2-4 korte alinea's","interpretation":"wat de voortgang of gemeten ontwikkeling praktisch betekent","workSummary":"bullets met concreet uitgevoerd werk","caveats":"bullets met eerlijke aandachtspunten en eventuele meetbeperking","nextSteps":"bullets met focus voor komende maand"}.`;
