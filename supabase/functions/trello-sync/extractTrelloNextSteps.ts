import type {
  TrelloCardInput,
  TrelloCheckItemInput,
  TrelloCommentInput,
} from "./trelloCardTypes.ts";

const SECTION_HEADING =
  /^(?:#{1,6}\s*)?(?:volgende stap(?:pen)?|actiepunten|acties|to[ -]?do)(?:\s*:)?\s*$/i;
const ANY_HEADING = /^#{1,6}\s+/;
const INLINE_STEP =
  /^(?:[-*+]\s*)?(?:volgende stap|actiepunt|actie|to[ -]?do)\s*:\s*(.+)$/i;
const BULLET = /^(\s*)[-*+]\s+(.+)$/;
const CHECKBOX = /^\[([ xX])\]\s*/;

const stripMarkdown = (value: string): string =>
  value
    .replace(CHECKBOX, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const dateFromStep = (text: string): string | null => {
  const iso = text.match(
    /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
  );
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dutch = text.match(
    /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/,
  );
  if (!dutch) return null;
  return `${dutch[3]}-${dutch[2].padStart(2, "0")}-${dutch[1].padStart(2, "0")}`;
};

interface StepSource {
  id: string;
  text: string;
}

const stepsFromSource = (source: StepSource): TrelloCheckItemInput[] => {
  const result: TrelloCheckItemInput[] = [];
  const lines = source.text.split(/\r?\n/);
  let inStepSection = false;
  let stepOrdinal = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (SECTION_HEADING.test(trimmed)) {
      inStepSection = true;
      continue;
    }
    if (inStepSection && ANY_HEADING.test(trimmed)) {
      inStepSection = false;
      continue;
    }

    let rawStep: string | null = null;
    if (inStepSection) {
      const bullet = rawLine.match(BULLET);
      // Only top-level bullets become tasks. Nested bullets usually explain
      // the parent step and would otherwise produce noisy duplicates.
      if (bullet && bullet[1].length === 0) rawStep = bullet[2];
    } else {
      rawStep = trimmed.match(INLINE_STEP)?.[1] ?? null;
    }
    if (!rawStep) continue;

    const checkbox = rawStep.match(CHECKBOX);
    const complete = checkbox?.[1].toLowerCase() === "x";
    const name = stripMarkdown(rawStep);
    if (!name) continue;

    result.push({
      // The ordinal is stable when unrelated prose/blank lines are edited and
      // lets a renamed step update in place instead of losing a CRM assignee.
      id: `derived:${source.id}:${stepOrdinal}`,
      name,
      complete,
      memberId: null,
      due: dateFromStep(name),
    });
    stepOrdinal += 1;
  }

  return result;
};

// Turns only explicitly labelled next-step text into tasks. It deliberately
// does not attempt open-ended language understanding: arbitrary prose remains
// a CRM note, while "Volgende stappen"/"Actie:" is predictable and testable.
export const extractTrelloNextSteps = ({
  description,
  comments = [],
}: {
  description: string;
  comments?: TrelloCommentInput[];
}): TrelloCheckItemInput[] => {
  const sources: StepSource[] = [
    { id: "description", text: description },
    ...comments.map((comment) => ({
      id: `comment:${comment.id}`,
      text: comment.text,
    })),
  ];
  const seen = new Set<string>();

  return sources.flatMap(stepsFromSource).filter((step) => {
    const key = step.name.toLocaleLowerCase("nl-NL");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const withDerivedTrelloSteps = (
  card: TrelloCardInput,
): TrelloCardInput => ({
  ...card,
  checkItems: [
    ...card.checkItems,
    ...extractTrelloNextSteps({
      description: card.desc,
      comments: card.comments,
    }),
  ],
});
