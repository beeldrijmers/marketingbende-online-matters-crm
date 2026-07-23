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

const CREDENTIAL_LABEL =
  /\b(?:inlog(?:gegevens)?|login|gebruikersnaam|user(?:name)?|wachtwoord|password|api[- _]?key|secret|token|auth(?:enticatie)?|wp[- ]?admin)\b/i;
const SECRETISH_VALUE =
  /^(?=.{10,180}$)(?=\S+$)(?=.*[a-z])(?=.*(?:\d|[^a-z0-9])).+$/i;
const EMAIL_ADDRESS = /\b[\w.+%-]+@[\w.-]+\.[a-z]{2,}\b/gi;
const INTERNAL_URL =
  /https?:\/\/(?:crm\.marketingbende\.nl|trello\.com|inzyte\.io)\S*/gi;
const REPORT_NOTE_ID = /^seo-monthly-report:/i;

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
      if (!line) continue;
      if (SECRETISH_VALUE.test(line) || /^https?:\/\//i.test(line)) continue;
    }
    if (CREDENTIAL_LABEL.test(line)) {
      skipSensitiveLines = 3;
      continue;
    }
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
    items.push({
      id: `mail:${message.id}`,
      kind: "sent_email",
      date: asDate(message.date),
      title: subject || "Verzonden e-mail",
      excerpt,
      // Status updates are often sent shortly after month end.
      currentPeriod: withinPeriod(message.date, period, 21),
    });
  }

  const deduped = uniqueEvidence(items).sort((left, right) =>
    String(right.date || "").localeCompare(String(left.date || "")),
  );
  const counts = deduped.reduce<ReportEvidenceCounts>(
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

  return {
    items: deduped,
    current: deduped.filter((item) => item.currentPeriod),
    allTime: deduped,
    counts,
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

const evidenceLines = (item: ReportEvidenceItem, pattern: RegExp): string[] =>
  item.excerpt
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) =>
      line
        .replace(/^[-*•\d.)\s]+/, "")
        .replace(/^#+\s*/, "")
        .trim(),
    )
    .filter((line) => line.length >= 18 && line.length <= 360)
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
  const comparable = metrics.filter(
    (metric) => metric.changePercent !== null && metric.group === "seo",
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
  const currentWork = evidence.current.filter(
    (item) => item.kind === "completed_work",
  );
  const currentSourceCount = evidence.current.filter(
    (item) => item.kind !== "assignment",
  ).length;

  const summary: string[] = [
    `In ${monthLabel(period.reportingMonth)} hebben we voor ${companyName} verder gebouwd aan de organische vindbaarheid en de kwaliteit van de website. De update is gebaseerd op de meetgegevens én ${currentSourceCount} relevante voortgangsbron${currentSourceCount === 1 ? "" : "nen"} uit de opdracht.`,
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
      `${currentWork.length} concrete werkzaamhe${currentWork.length === 1 ? "id is" : "den zijn"} deze meetmaand als afgerond vastgelegd.`,
    );
  }
  if (attention) {
    summary.push(
      `Tegelijk vraagt ${attention.label.toLocaleLowerCase("nl-NL")} aandacht; dit meetpunt ontwikkelde zich ${changeText(attention)}. Dat nemen we mee in de prioriteiten voor de komende maand.`,
    );
  }

  const interpretation = [
    favourable
      ? `De stijging bij ${favourable.label.toLocaleLowerCase("nl-NL")} laat zien dat de website in deze periode beter presteerde op dit onderdeel.`
      : "De cijfers laten in deze periode vooral een stabiele basis zien waarop verder kan worden geoptimaliseerd.",
    attention
      ? `De minder gunstige ontwikkeling bij ${attention.label.toLocaleLowerCase("nl-NL")} betekent dat we niet alleen naar groei kijken, maar ook gericht controleren waar bereik, relevantie of doorklik mogelijk achterblijft.`
      : "Er is geen afzonderlijk SEO-kerncijfer dat in deze vergelijking als duidelijke terugval is aangemerkt.",
    "We koppelen deze ontwikkeling aan het uitgevoerde werk als onderbouwing, niet als bewijs dat één wijziging het volledige resultaat heeft veroorzaakt.",
  ].join(" ");

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
      "Een maand-op-maandvergelijking blijft gevoelig voor seizoen, campagnes, concurrentie en wijzigingen buiten de SEO-werkzaamheden",
    ],
    4,
  ).join("\n");

  const futureLines = evidence.allTime.flatMap((item) =>
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
      "De belangrijkste SEO-kerncijfers opnieuw vergelijken zodra de volgende kalendermaand volledig meetbaar is",
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
    meetmaand: period.reportingMonth,
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
    bronTellingen: evidence.counts,
  }).slice(0, 28_000);

export const MONTHLY_NARRATIVE_QUESTION = `Schrijf op basis van het aangeleverde bronmateriaal een klantklare Nederlandse SEO-maandupdate in de toon van een persoonlijke, deskundige statusmail. Gebruik uitsluitend aantoonbare feiten uit het bronmateriaal. Formuleer positief waar de cijfers dat toelaten, benoem minder gunstige ontwikkelingen en onzekerheden eerlijk, en eindig met concreet toekomstperspectief. Maak geen oorzakelijke claims die niet zijn bewezen. Noem geen interne systemen, kaartsoftware, mailboxsoftware, CRM of analyseplatform. Neem werkzaamheden uit de meetmaand op; gebruik oudere informatie alleen als relevante context. Geef uitsluitend geldige JSON terug met exact deze velden: {"clientSummary":"2-4 korte alinea's","interpretation":"wat de ontwikkeling praktisch betekent","workSummary":"bullets met concreet uitgevoerd werk","caveats":"bullets met eerlijke aandachtspunten","nextSteps":"bullets met focus voor komende maand"}.`;
