import type { Deal, DealStage, Task } from "../types";

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
  >;
  companyName: string;
  /** Stage labels from the app configuration, so wording follows the board. */
  stages: DealStage[];
  /** All steps on the deal, done and open. */
  steps: Pick<Task, "text" | "done_date" | "due_date">[];
  /** Who is sending it, for the sign-off. */
  senderName?: string;
  now: Date;
}

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
  senderName,
  stages,
  steps,
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
      heading:
        doneSince.length > 0 && lastUpdate
          ? `Gedaan sinds ${DAY_MONTH.format(lastUpdate)}`
          : "Wat er is gedaan",
      lines: recent.map((step) => asSentence(step.text)).filter(Boolean),
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
    delivery
      ? delivery.getTime() < now.getTime()
        ? "De opgegeven opleverdatum is verstreken; we stemmen een nieuwe datum met u af."
        : `Oplevering staat gepland op ${DATE.format(delivery)}.`
      : null,
    waiting,
  ].filter((line): line is string => Boolean(line));
  if (planning.length > 0) {
    sections.push({ heading: "Planning", lines: planning });
  }

  const subject = `Statusupdate ${companyName} - ${deal.name}`;
  const greeting = "Beste,";
  const closing = senderName
    ? `Met vriendelijke groet,\n${senderName}`
    : "Met vriendelijke groet";

  const body = [
    greeting,
    "",
    `Een korte update over ${deal.name.toLowerCase().startsWith(companyName.toLowerCase()) ? deal.name : `${deal.name} (${companyName})`}.`,
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
