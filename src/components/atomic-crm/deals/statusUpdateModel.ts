import type {
  Deal,
  DealStage,
  SeoMonthlyHeadlineMetric,
  SeoMonthlyReportSummary,
  Task,
} from "../types";
import { changeLabel, metricValue } from "./inzyte/seoMonthlyReportDocument";

/**
 * The status update a client actually gets.
 *
 * Every fact in it is already in the CRM — the stage, the steps that were
 * ticked off, the step that is next, what we are waiting for — but it only ever
 * existed as internal shorthand ("[WEBSITE] on hold", "wacht op input"). This
 * turns that into whole Dutch sentences someone can send without editing, and
 * keeps it plain text so it survives WhatsApp, mail and a printed PDF alike.
 *
 * Pure: no dates from the clock, no data fetching. The caller passes `now`.
 */

export interface StatusUpdateInput {
  /** Deal being reported on. */
  deal: Pick<
    Deal,
    | "name"
    | "stage"
    | "on_hold"
    | "delivery_date"
    | "expected_closing_date"
    | "client_updated_at"
    | "revenue_period"
  >;
  companyName: string;
  /** Stage labels from the app configuration, so wording follows the board. */
  stages: DealStage[];
  /** All steps on the deal, done and open. */
  steps: Pick<Task, "text" | "done_date" | "due_date">[];
  /** Who is sending it, for the sign-off. */
  senderName?: string;
  /**
   * "full" is a letter for mail, a PDF or a shared page. "short" is the same
   * facts in four lines, because half of these updates go out over WhatsApp and
   * a letter pasted into a chat reads as a form mail.
   */
  variant?: StatusUpdateVariant;
  /**
   * Measured results from the Search Console / GA4 connection, when there is
   * one. Absent for work without a connection, and then the update simply has no
   * results block — never an empty heading.
   */
  results?: StatusUpdateResults;
  now: Date;
}

export interface StatusUpdateResults {
  /** The month the figures cover, e.g. "juni". */
  monthLabel?: string;
  metrics: SeoMonthlyHeadlineMetric[];
}

export type StatusUpdateVariant = "full" | "short";

export interface StatusUpdate {
  subject: string;
  /** Ready-to-send plain text. */
  body: string;
  /** The blocks the body is composed of, exposed for tests and future renderers. */
  sections: { heading: string; lines: string[] }[];
  /** Steps completed since the previous update — what makes an update worth sending. */
  completedSinceLastUpdate: number;
}

const DATE = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DAY_MONTH = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
});

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const stageLabel = (stages: DealStage[], stage: string): string =>
  stages.find((candidate) => candidate.value === stage)?.label ?? stage;

/**
 * What the phase means for the client, in their words rather than ours. The
 * board's own labels are written for the team ("Nog niet bevestigd", "Wacht op
 * input"); a client reads them as jargon or, worse, as a reproach.
 */
const STAGE_SENTENCE: Record<string, string> = {
  "informatie-pipeline":
    "We hebben het voorstel klaarliggen en wachten op uw akkoord.",
  "bevestigd-inplannen":
    "De opdracht is bevestigd en staat klaar om ingepland te worden.",
  "on-hold": "De opdracht staat tijdelijk stil.",
  bezig: "We zijn aan het werk.",
  "controle-livegang":
    "Het werk is af en klaar voor de laatste controle en livegang.",
  "facturatie-live": "Het werk staat live; de factuur volgt.",
  won: "De opdracht is afgerond.",
  maandelijks: "Het maandelijkse werk loopt.",
};

const sentenceCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const isRecurring = (deal: StatusUpdateInput["deal"]) =>
  deal.revenue_period === "maandelijks" || deal.stage === "maandelijks";

const isFinished = (deal: StatusUpdateInput["deal"]) =>
  deal.stage === "facturatie-live" || deal.stage === "won";

/**
 * Recurring work is reported per month, so the heading says which month — "Gedaan
 * sinds 30 juni" is technically true and tells a client nothing about the report
 * they are holding.
 */
const workHeading = ({
  deal,
  hasSince,
  lastUpdate,
}: {
  deal: StatusUpdateInput["deal"];
  hasSince: boolean;
  lastUpdate: Date | null;
}): string => {
  if (isRecurring(deal) && lastUpdate) {
    // The month the reported work belongs to: the one the last update closed off.
    const month = MONTHS[lastUpdate.getMonth()];
    return `Wat we in ${month} hebben gedaan`;
  }
  return hasSince && lastUpdate
    ? `Gedaan sinds ${DAY_MONTH.format(lastUpdate)}`
    : "Wat er is gedaan";
};

/** What happens next, so the client does not have to ask again. */
const nextMoment = (
  deal: StatusUpdateInput["deal"],
  now: Date,
): string | null => {
  if (deal.stage === "facturatie-live") {
    return "De factuur volgt; daarna sluiten we de opdracht af.";
  }
  if (deal.stage === "won") {
    // A closing update that says only "afgerond" is a dead end. Say what the
    // client can do next, which is also how follow-up work starts.
    return "Daarmee is deze opdracht afgerond. Voor vervolg of onderhoud kunt u ons altijd bereiken.";
  }
  if (isRecurring(deal)) {
    const month = MONTHS[(now.getMonth() + 1) % 12];
    return `Begin ${month} sturen we de volgende maandupdate.`;
  }
  return "Bij de volgende stap hoort u weer van ons.";
};

/** A measured result in a sentence, not a dashboard row. */
const metricLine = (metric: SeoMonthlyHeadlineMetric): string => {
  const value = metricValue(metric, metric.current);
  return metric.changePercent === null
    ? `${metric.label}: ${value} (eerste meting).`
    : `${metric.label}: ${value} (${changeLabel(metric)} tegenover de vorige periode).`;
};

/**
 * Turn the latest month report into the results block — but only when it is the
 * report the client is being told about.
 *
 * A June report inside a July update is not enrichment, it is a wrong number
 * with a confident label, so anything older than last month is left out. Metrics
 * about the site's own traffic and its Google visibility are what a client reads;
 * the rest of the report stays internal.
 */
export const selectStatusUpdateResults = (
  report: SeoMonthlyReportSummary | null | undefined,
  now: Date,
): StatusUpdateResults | undefined => {
  if (!report?.headline_metrics?.length) return undefined;

  const month = new Date(report.reporting_month);
  if (Number.isNaN(month.getTime())) return undefined;

  const monthsBehind =
    (now.getFullYear() - month.getFullYear()) * 12 +
    (now.getMonth() - month.getMonth());
  if (monthsBehind < 0 || monthsBehind > 1) return undefined;

  const metrics = report.headline_metrics.filter(
    (metric) => metric.group === "seo" || metric.group === "website_context",
  );
  if (metrics.length === 0) return undefined;

  return { metrics, monthLabel: MONTHS[month.getMonth()] };
};

/** A step reads as a sentence, not as a checklist entry. */
const asSentence = (text: string): string => {
  const trimmed = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/, "");
  return trimmed ? `${sentenceCase(trimmed)}.` : "";
};

export const buildStatusUpdate = ({
  companyName,
  deal,
  now,
  results,
  senderName,
  stages,
  steps,
  variant = "full",
}: StatusUpdateInput): StatusUpdate => {
  const lastUpdate = parseDate(deal.client_updated_at);
  const done = steps
    .filter((step) => step.done_date)
    .map((step) => ({ ...step, doneAt: parseDate(step.done_date) }))
    .sort(
      (left, right) =>
        (right.doneAt?.getTime() ?? 0) - (left.doneAt?.getTime() ?? 0),
    );
  const doneSince = lastUpdate
    ? done.filter(
        (step) => (step.doneAt?.getTime() ?? 0) > lastUpdate.getTime(),
      )
    : done;
  const open = steps.filter((step) => !step.done_date);

  const sections: { heading: string; lines: string[] }[] = [];

  const state = [
    deal.on_hold && deal.stage !== "on-hold"
      ? "De opdracht staat tijdelijk stil."
      : (STAGE_SENTENCE[deal.stage] ??
        `Status: ${stageLabel(stages, deal.stage)}.`),
  ];
  sections.push({ heading: "Waar we staan", lines: state });

  // Only the recent work: a client does not need the full history back to
  // January, and a list of twenty ticks reads as noise.
  const recent = (doneSince.length > 0 ? doneSince : done).slice(0, 6);
  if (recent.length > 0) {
    sections.push({
      heading: workHeading({
        deal,
        lastUpdate,
        hasSince: doneSince.length > 0,
      }),
      lines: recent.map((step) => asSentence(step.text)).filter(Boolean),
    });
  }

  // Measured results, when a Search Console / GA4 connection produced a month
  // report. Recurring SEO work is judged on numbers, and a monthly update that
  // only lists activities invites the question the numbers already answer.
  if (results && results.metrics.length > 0) {
    sections.push({
      heading: results.monthLabel
        ? `Resultaten in ${results.monthLabel}`
        : "Resultaten",
      lines: results.metrics.slice(0, 4).map(metricLine),
    });
  }

  if (open.length > 0) {
    sections.push({
      heading: "Wat er nu gebeurt",
      lines: open
        .slice(0, 5)
        .map((step) => asSentence(step.text))
        .filter(Boolean),
    });
  }

  const waiting =
    deal.stage === "on-hold" || deal.on_hold
      ? "Zodra we van u horen, pakken we het direct weer op."
      : deal.stage === "informatie-pipeline"
        ? "Zodra u akkoord geeft, plannen we het werk in."
        : deal.stage === "controle-livegang"
          ? "Laat u weten of u nog aanpassingen wilt? Daarna zetten we het live."
          : null;

  const delivery = parseDate(deal.delivery_date ?? deal.expected_closing_date);
  const planning = [
    // Finished work has no planning left; it has an invoice and a next moment.
    isFinished(deal)
      ? null
      : delivery
        ? delivery.getTime() < now.getTime()
          ? "De opgegeven opleverdatum is verstreken; we stemmen een nieuwe datum met u af."
          : `Oplevering staat gepland op ${DATE.format(delivery)}.`
        : null,
    waiting,
    // An update that ends without a next moment leaves the client guessing
    // again, which is the whole thing this is meant to stop.
    nextMoment(deal, now),
  ].filter((line): line is string => Boolean(line));
  if (planning.length > 0) {
    sections.push({
      heading: isFinished(deal) ? "Hoe verder" : "Planning",
      lines: planning,
    });
  }

  const subject = `Statusupdate ${companyName} - ${deal.name}`;
  const greeting = "Beste,";
  const closing = senderName
    ? `Met vriendelijke groet,\n${senderName}`
    : "Met vriendelijke groet";

  const subjectOfUpdate = deal.name
    .toLowerCase()
    .startsWith(companyName.toLowerCase())
    ? deal.name
    : `${deal.name} (${companyName})`;

  const body =
    variant === "short"
      ? // A chat message: no greeting, no sign-off, one line per block. The
        // recipient already knows who is writing.
        [
          `Update ${subjectOfUpdate}`,
          ...sections.map(
            (section) => `${section.heading}: ${section.lines.join(" ")}`,
          ),
        ].join("\n")
      : [
          greeting,
          "",
          `Een korte update over ${subjectOfUpdate}.`,
          "",
          ...sections.flatMap((section) => [
            `${section.heading}:`,
            ...section.lines.map((line) => `- ${line}`),
            "",
          ]),
          "Heeft u vragen of aanvullingen? Laat het weten, dan pakken we het op.",
          "",
          closing,
        ].join("\n");

  return {
    subject,
    body,
    sections,
    completedSinceLastUpdate: doneSince.length,
  };
};

/**
 * One update covering everything that runs for a client.
 *
 * Hunting XL has four open assignments; sending four separate updates about the
 * same relationship reads as four unrelated projects and takes four times as
 * long. This keeps one greeting and one sign-off, and gives each assignment its
 * own block so the client can still see which is which.
 */
export const buildCompanyStatusUpdate = ({
  companyName,
  deals,
  now,
  senderName,
  stages,
  variant = "full",
}: {
  companyName: string;
  /**
   * Each open assignment with its own steps and, where a connection exists, its
   * own measured results — in the order they should appear.
   */
  deals: {
    deal: StatusUpdateInput["deal"];
    steps: StatusUpdateInput["steps"];
    results?: StatusUpdateResults;
  }[];
  stages: DealStage[];
  senderName?: string;
  variant?: StatusUpdateVariant;
  now: Date;
}): StatusUpdate => {
  const perDeal = deals.map(({ deal, results, steps }) =>
    buildStatusUpdate({
      companyName,
      deal,
      now,
      results,
      senderName,
      stages,
      steps,
      variant,
    }),
  );

  // Each assignment becomes one block: its name as the heading, its own lines
  // underneath. Lines that list work get their block name in front of them so
  // "done" and "next" stay distinguishable inside one list; the state and the
  // planning read as sentences already and keeping a label there ("Planning:
  // Laat u weten of…") only made them clumsy.
  const sections = deals.map(({ deal }, index) => ({
    heading: deal.name,
    lines: perDeal[index].sections.flatMap((section) =>
      section.heading === "Waar we staan" || section.heading === "Planning"
        ? section.lines
        : section.lines.map((line) => `${section.heading}: ${line}`),
    ),
  }));

  const subject =
    deals.length === 1
      ? perDeal[0].subject
      : `Statusupdate ${companyName} - ${deals.length} lopende opdrachten`;

  const body =
    variant === "short"
      ? [
          `Update ${companyName}`,
          ...sections.map(
            (section) => `${section.heading}: ${section.lines.join(" ")}`,
          ),
        ].join("\n")
      : [
          "Beste,",
          "",
          deals.length === 1
            ? `Een korte update over ${deals[0].deal.name}.`
            : `Een korte update over het werk dat voor u loopt.`,
          "",
          ...sections.flatMap((section) => [
            `${section.heading}:`,
            ...section.lines.map((line) => `- ${line}`),
            "",
          ]),
          "Heeft u vragen of aanvullingen? Laat het weten, dan pakken we het op.",
          "",
          senderName
            ? `Met vriendelijke groet,\n${senderName}`
            : "Met vriendelijke groet",
        ].join("\n");

  return {
    subject,
    body,
    sections,
    completedSinceLastUpdate: perDeal.reduce(
      (total, update) => total + update.completedSinceLastUpdate,
      0,
    ),
  };
};
