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

/**
 * Beleefdheden uit interne post zijn geen opgeleverd werk.
 *
 * Het bronmateriaal is voor een groot deel mail tussen collega's, en daar staat
 * omheen wat in elke mail staat. Zo kwam "Laat het weten als je nog iets
 * aangepast wilt zien" in een klantrapportage terecht als werkzaamheid, en
 * "Hoi John, even een andere focus deze maand" als vervolgstap. De aanhef van
 * een collega hoort niet in een brief aan de klant.
 */
const PLEASANTRY =
  /^(?:hoi|hallo|hey|hai|beste|geachte|dag)\b|\b(?:met vriendelijke groet|met hartelijke groet|groetjes|alvast bedankt|laat (?:het|maar) weten|hoor ik graag|mocht je nog|als je nog|succes ermee|fijne dag|fijn weekend)\b/i;

/**
 * Een kop kondigt iets aan, hij beweert niets. Twee vormen komen voor in het
 * bronmateriaal, en allebei werden ze een mededeling:
 *
 *   "Wat we hebben opgeleverd:"   -> "Wat we hebben opgeleverd."
 *   "*Wat we hebben opgeleverd*"  -> "Wat we hebben opgeleverd."
 *
 * De tweede is de reden dat alleen op een dubbele punt letten niet genoeg was:
 * een regel die helemaal tussen nadrukstekens staat is opmaak, geen zin.
 */
/**
 * Een kop met een getal erin is geen kop maar het feit zelf.
 *
 *   *Wat we hebben opgeleverd*            -> aankondiging, weg ermee
 *   *Opgeleverd: 15 nieuwe landingspagina's* -> dit IS de mededeling
 *
 * Zonder dit onderscheid verdween precies de regel die telt: de rapportage van
 * RT Interieur meldde "geen werkzaamheden vastgelegd" terwijl er vijftien
 * pagina's in de bronmail stonden.
 */
const carriesNumber = (line: string): boolean => /\d/.test(line);

const isHeading = (line: string): boolean => {
  const trimmed = line.trim();
  if (carriesNumber(trimmed)) return false;
  return /:$/.test(trimmed) || /^\*+[^*]+\*+$/.test(trimmed);
};

/**
 * De derde vorm: een kop zonder enig teken eromheen.
 *
 *   ... en de bestaande reparatiepagina's visueel en inhoudelijk
 *
 *   Wat we hebben opgeleverd
 *
 *   7 nieuwe, volledig geoptimaliseerde reparatiepagina's per plaats.
 *
 * Als losse regel is die niet van een korte zin te onderscheiden, maar als blok
 * wel: hij staat alleen tussen witregels, is kort en eindigt niet op een punt.
 * Alleen toepassen op tekst die uit meerdere blokken bestaat, want een
 * Trello-notitie is vaak één korte regel zonder punt ("Redirectfout verholpen")
 * en dat is juist wel een mededeling.
 */
const isPlainHeadingBlock = (block: string): boolean => {
  const trimmed = block.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 60 &&
    !trimmed.includes("\n") &&
    !carriesNumber(trimmed) &&
    !/[.!?]$/.test(trimmed)
  );
};

/**
 * Alleen echte opsommingstekens weghalen, geen cijfers die bij de zin horen.
 *
 * Dit stond op `^[-*•\d.)\s]+`, en dat at het begin op van "15 nieuwe,
 * geoptimaliseerde pagina's opgeleverd": wat overbleef begon met een kleine
 * letter en verdween daarna als brokstuk. Het aantal is juist het enige harde
 * feit in zo'n zin.
 */
const stripListMarker = (line: string): string =>
  line.replace(/^\s*(?:[-*•‣]+|\d{1,2}[.)])\s+/, "");

const evidenceLines = (item: ReportEvidenceItem, pattern: RegExp): string[] => {
  const blocks = unwrapHardBreaks(item.excerpt).split(/\n\s*\n/);
  const body =
    blocks.length >= 3
      ? blocks.filter((block) => !isPlainHeadingBlock(block))
      : blocks;

  return (
    body
      .join("\n\n")
      .split(/\n|(?<=[.!?])\s+/)
      .filter((line) => !isHeading(line))
      .map((line) =>
        stripEmphasis(
          stripListMarker(line)
            .replace(/^#+\s*/, "")
            .trim(),
        ),
      )
      .filter((line) => !PLEASANTRY.test(line))
      .filter((line) => line.length >= 18 && line.length <= 360)
      // Begint hij na dat alles nog met een kleine letter, dan ontbreekt het begin
      // van de zin. Aanvullen kan niet, dus dan is weglaten eerlijker dan een
      // regel die halverwege begint.
      .filter((line) => !/^[a-z]/.test(line))
      .filter((line) => pattern.test(line))
  );
};

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

// De verbogen vorm telt mee: "15 nieuwe, volledig geoptimaliseerde pagina's" is
// de zin die het meest concreet zegt wat er is opgeleverd, en die viel af omdat
// alleen "geoptimaliseerd" zonder uitgang werd herkend.
const COMPLETED_PATTERN =
  /\b(?:afgerond|aangepast|aangescherpt|gebouwd|gecontroleerd|gecorrigeerd|geïndexeerd|geoptimaliseerd|gepubliceerd|gerepareerd|geschreven|hersteld|ingediend|live gezet|opgeleverd|toegevoegd|uitgevoerd|verholpen|vernieuwd)e?\b/i;
const FUTURE_PATTERN =
  /\b(?:aanbevel|blijven monitoren|komende maand|komende periode|daarna|focus|gaan we|inplannen|monitoren|oppakken|uitbreiden|verder|vervolg|zodra)\b/i;

/**
 * Wat we al gedaan hebben is geen plan.
 *
 * "verder" en "focus" zijn zwakke aanwijzingen: ze staan net zo goed in een
 * terugblik ("In juni hebben we de strategie voortgezet om ... verder op te
 * bouwen"), en zo belandde een zin over vorige maand onder de kop wat er komende
 * maand gebeurt. Een zin met een voltooide tijd hoort daar niet.
 */
const PAST_TENSE =
  /\b(?:hebben we|hebben wij|we hebben|wij hebben|is opgeleverd|zijn opgeleverd)\b/i;
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
        // Zonder voortgangsbronnen combineert deze update niets: dan stond er
        // letterlijk "combineert gecontroleerde meetgegevens met 0 relevante
        // voortgangsbronnen", een zin die zichzelf tegenspreekt.
        currentSourceCount === 0
          ? `In ${monthLabel(period.reportingMonth)} hebben we voor ${companyName} verder gewerkt aan de afgesproken digitale doelen. Deze update gaat over de gemeten ontwikkeling; over de werkzaamheden van deze maand is in het dossier niets vastgelegd.`
          : `In ${monthLabel(period.reportingMonth)} hebben we voor ${companyName} verder gewerkt aan de afgesproken digitale doelen. Deze update combineert gecontroleerde meetgegevens met ${currentSourceCount} relevante voortgangsbron${currentSourceCount === 1 ? "" : "nen"} uit de opdracht.`,
      ]
    : [
        // Geen cijfers en geen bronnen: dan is er niets om te rapporteren, en
        // dat hoort er te staan. Anders belooft de openingszin een update "op
        // basis van 0 voortgangsbronnen" over "aantoonbaar uitgevoerd werk" dat
        // er niet is -- een rapportage die alleen zichzelf beschrijft.
        currentSourceCount === 0
          ? `Over ${monthLabel(period.reportingMonth)} is voor ${companyName} geen gecontroleerde meetreeks beschikbaar en zijn er geen werkzaamheden vastgelegd. Er is dus nog niets dat we verantwoord met de klant kunnen delen; controleer de meetbron of leg de werkzaamheden van deze maand vast.`
          : `In ${monthLabel(period.reportingMonth)} hebben we de voortgang voor ${companyName} in kaart gebracht op basis van ${currentSourceCount} relevante voortgangsbron${currentSourceCount === 1 ? "" : "nen"} uit de opdracht. Er was geen volledige gecontroleerde meetreeks beschikbaar; deze update gaat daarom over aantoonbaar uitgevoerd werk en voortgang, niet over verkeers- of rankingresultaten.`,
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

  const futureLines = evidence.current
    .flatMap((item) => evidenceLines(item, FUTURE_PATTERN))
    .filter((line) => !PAST_TENSE.test(line));
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

/**
 * Escapet echte regeleindes en tabs BINNEN JSON-tekstwaarden.
 *
 * Dit is de reden dat rijke rapportteksten stilletjes wegvielen. Zodra je een
 * model om alinea's en opsommingen vraagt, zet het letterlijke regeleindes in de
 * stringwaarden. Dat is ongeldige JSON (controltekens moeten `\n` zijn), dus
 * `JSON.parse` gooide, kwam er een fallback terug, en de klant kreeg een rapport
 * met lege secties zonder dat er ergens een fout zichtbaar werd. Hoe beter het
 * antwoord, hoe groter de kans dat het sneuvelde.
 */
export const repairJsonControlChars = (value: string): string => {
  let inString = false;
  let escaped = false;
  let result = "";
  for (const char of value) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && (char === "\n" || char === "\r" || char === "\t")) {
      result += char === "\n" ? "\\n" : char === "\r" ? "\\r" : "\\t";
      continue;
    }
    result += char;
  }
  return result;
};

const readNarrativeJson = (value: string): Record<string, unknown> | null => {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const kandidaat = withoutFence.slice(start, end + 1);
  const asObject = (parsed: unknown): Record<string, unknown> | null =>
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  try {
    return asObject(JSON.parse(kandidaat));
  } catch {
    // Tweede poging met herstelde controltekens; blijft het stuk, dan pas opgeven.
    try {
      return asObject(JSON.parse(repairJsonControlChars(kandidaat)));
    } catch {
      return null;
    }
  }
};

/**
 * Zet wat het model teruggeeft om naar tekst.
 *
 * Vraag je om "bullets met concreet uitgevoerd werk", dan levert het model dat
 * als JSON-array aan, niet als string met regeleindes. Dat is een even redelijke
 * lezing van de opdracht, maar `asText` gaf voor een array gewoon "" terug.
 * Gevolg: precies de velden waar we om opsommingen vroegen (werkzaamheden,
 * aandachtspunten, vooruitblik) vielen leeg terug, terwijl de JSON zelf klopte.
 */
const narrativeText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const regel = narrativeText(item).trim();
        if (!regel) return "";
        // Al voorzien van een opsommingsteken? Dan niet dubbelop zetten.
        return /^[-*\u2022]/.test(regel) ? regel : `- ${regel}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => narrativeText(item).trim())
      .filter(Boolean)
      .join("\n");
  }
  return asText(value);
};

const safeNarrativeField = (
  value: unknown,
  fallback: string,
  minimum: number,
): string => {
  const sanitized = sanitizeReportEvidenceText(narrativeText(value), 12_000);
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
/**
 * Controleert of alle getallen in EEN tekst gedekt worden door de meetcijfers.
 *
 * Was eerder alles-of-niets over de hele rapportage: een enkel percentage dat
 * niet exact overeenkwam met een gemeten waarde gooide de complete klanttekst
 * weg, waarna de klant lege secties kreeg zonder enige melding. De bedoeling
 * klopt (geen verzonnen cijfers naar een klant), de reikwijdte niet.
 */
export const isTextSupportedByMetrics = (
  text: string,
  metrics: MonthlyHeadlineMetric[],
): boolean => {
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

const NARRATIVE_FIELDS = [
  "clientSummary",
  "interpretation",
  "workSummary",
  "caveats",
  "nextSteps",
] as const;

export const isNarrativeSupportedByMetrics = (
  narrative: ReportNarrative,
  metrics: MonthlyHeadlineMetric[],
): boolean =>
  isTextSupportedByMetrics(
    NARRATIVE_FIELDS.map((veld) => narrative[veld]).join("\n"),
    metrics,
  );

/**
 * Houdt per sectie alleen wat door de cijfers gedekt wordt.
 *
 * Een onderbouwde vooruitblik hoort niet te sneuvelen omdat er in de
 * samenvatting een percentage staat dat we niet kunnen staven. Alleen de sectie
 * die het betreft valt terug op de regelgebaseerde tekst; de rest blijft staan.
 */
/**
 * Secties die beschrijven WAT er is opgeleverd, niet wat er is gemeten.
 *
 * De cijfercontrole kan "15 gepubliceerde pagina's" niet onderscheiden van
 * "15 sessies": elk getal in een zin met een SEO-woord telt als meetclaim. Juist
 * de opsomming van geleverd werk wordt daardoor gegarandeerd afgekeurd, en dat is
 * precies de sectie waar de klant om vraagt.
 *
 * Voor deze twee secties controleren we daarom alleen percentages. Een geclaimde
 * groei blijft dus gedekt, maar "15 pagina's" mag gewoon blijven staan.
 */
const DELIVERABLE_FIELDS = new Set(["workSummary", "nextSteps"]);

const isFieldSupported = (
  veld: (typeof NARRATIVE_FIELDS)[number],
  tekst: string,
  metrics: MonthlyHeadlineMetric[],
): boolean => {
  if (!DELIVERABLE_FIELDS.has(veld)) {
    return isTextSupportedByMetrics(tekst, metrics);
  }
  const percentages = Array.from(
    tekst.matchAll(/(-?\d+(?:[.,]\d+)?)\s*%/g),
    (match) => Math.abs(Number(match[1].replace(",", "."))),
  ).filter(Number.isFinite);
  if (percentages.length === 0) return true;
  return isTextSupportedByMetrics(tekst, metrics);
};

export const withSupportedFieldsOnly = (
  narrative: ReportNarrative,
  fallback: ReportNarrative,
  metrics: MonthlyHeadlineMetric[],
): ReportNarrative => {
  const resultaat = { ...narrative };
  let behouden = 0;
  for (const veld of NARRATIVE_FIELDS) {
    if (isFieldSupported(veld, narrative[veld] || "", metrics)) {
      behouden += 1;
      continue;
    }
    resultaat[veld] = fallback[veld];
  }
  // Overleeft geen enkele sectie, dan is de hele tekst onbetrouwbaar en nemen we
  // de terugval inclusief herkomst, zodat niemand denkt dat dit AI-tekst is.
  return behouden === 0 ? fallback : resultaat;
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
    huidigeMaand: evidence.current.slice(0, 60).map((item) => ({
      soort: item.kind,
      datum: item.date,
      tekst: item.excerpt.slice(0, 2_200),
    })),
    voorgeschiedenis: evidence.allTime.slice(0, 60).map((item) => ({
      soort: item.kind,
      datum: item.date,
      tekst: item.excerpt.slice(0, 1_100),
    })),
    bronTellingen: {
      rapportagemaand: evidence.currentCounts,
      volledigDossier: evidence.allTimeCounts,
    },
  }).slice(0, 90_000);

export const MONTHLY_NARRATIVE_QUESTION = `Schrijf op basis van het aangeleverde bronmateriaal een klantklare Nederlandse maandupdate in de toon van een persoonlijke, deskundige statusmail van de vaste SEO-specialist aan zijn opdrachtgever.

BRONNEN COMBINEREN
Het bronmateriaal bevat kerncijfers uit de meetbronnen, de opdrachtomschrijving, opmerkingen bij de opdrachtkaart, verzonden statusmails, voortgangsnotities en afgeronde werkzaamheden, plus voorgeschiedenis uit eerdere maanden. Gebruik ze in samenhang. Cijfers zonder het bijbehorende werk zijn betekenisloos, en werk zonder duiding is een opsomming. Verwijs waar het kan naar wat er in eerdere maanden is gedaan, zodat de klant de lijn over meerdere maanden ziet.

CONCREETHEID IS DE KERN
Noem het werk expliciet en met naam. Staan er in het bronmateriaal opgeleverde pagina's, URL's, plaatsnamen, aantallen, onderwerpen of paginatypes, neem die dan letterlijk op. Schrijf dus niet "er zijn pagina's toegevoegd" maar benoem hoeveel, welk type en waarover, met de URL's als die er zijn. Een lezer moet na het lezen precies weten wat hij heeft gekregen. Vage samenvattingen zijn een fout.

OMVANG
Schrijf uitgebreid en volledig; dit is geen korte notitie. clientSummary telt vier tot zes alinea's van elk drie tot zes zinnen. interpretation telt twee tot vier alinea's. workSummary bevat minimaal zes opsommingsregels, elk een volledige zin met het concrete resultaat, en groepeer per soort werk als dat helpt. caveats en nextSteps bevatten elk minimaal drie opsommingsregels met een toelichtende zin, niet slechts een steekwoord.

EERLIJKHEID
Gebruik uitsluitend aantoonbare feiten uit het bronmateriaal en verzin niets bij. Gebruik meetcijfers alleen als ze werkelijk zijn aangeleverd; zonder cijfers mag je geen groei, stabiliteit, verkeers-, advertentie-, conversie- of rankingresultaat suggereren. Ontbreekt een meetbron, benoem dat dan als beperking in caveats in plaats van eromheen te schrijven. Formuleer positief waar de feiten dat toelaten, maar benoem tegenvallers en onzekerheden expliciet. Maak geen oorzakelijke claims die niet zijn bewezen: cijfers kunnen het werk ondersteunen, niet bewijzen.

VORM
Nederlands, je-vorm richting de opdrachtgever, geen emoji, geen gedachtestreepjes. Noem geen interne systemen, kaartsoftware, mailboxsoftware, CRM of analyseplatform. Werk uit de rapportagemaand staat centraal; oudere informatie gebruik je als context en markeer je als zodanig.

Geef uitsluitend geldige JSON terug met exact deze velden: {"clientSummary":"4-6 alinea's","interpretation":"2-4 alinea's over wat de voortgang en cijfers praktisch betekenen","workSummary":"minimaal 6 opsommingsregels met concreet uitgevoerd werk, inclusief namen, aantallen en URL's","caveats":"minimaal 3 opsommingsregels met eerlijke aandachtspunten en meetbeperkingen","nextSteps":"minimaal 3 opsommingsregels met de focus voor komende maand"}.`;
