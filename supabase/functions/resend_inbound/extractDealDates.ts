// Pure helper: pull a project's start and delivery dates out of free-form Dutch
// email text. Marketing-agency intake mails phrase these as, e.g.
//   "aanvang 1 augustus 2026", "oplevering op 15 september 2026",
//   "deadline 20-03-2026", "start 01/09/2026".
//
// Two date shapes are recognised:
//   - day + Dutch month name + year: "15 september 2026", "1 aug 2026"
//   - numeric dd-mm-yyyy with "-", "/" or "." separators: "20-03-2026"
// A date only counts when it appears shortly (<= ~40 chars) after a label, so
// unrelated dates elsewhere in the mail are ignored. Returns ISO YYYY-MM-DD
// strings, or null per field when nothing matches.

// How far after a label we still accept a date (in characters).
const MAX_LABEL_TO_DATE_DISTANCE = 40;

// Labels that introduce, respectively, the start date and the delivery date.
// Longer variants come first so the word-boundary regex matches them whole.
const START_LABELS = ["startdatum", "aanvang", "start", "begin", "ingang"];
const DELIVERY_LABELS = [
  "opleverdatum",
  "oplevering",
  "opgeleverd",
  "deadline",
  "uiterlijk",
  "gereed",
  "klaar",
];

// Dutch month names (full + common abbreviations) -> 2-digit month.
const MONTHS: Record<string, string> = {
  januari: "01",
  jan: "01",
  februari: "02",
  feb: "02",
  maart: "03",
  mrt: "03",
  april: "04",
  apr: "04",
  mei: "05",
  juni: "06",
  jun: "06",
  juli: "07",
  jul: "07",
  augustus: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  oktober: "10",
  okt: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

// Builds an ISO date from its parts, returning null for out-of-range values.
const toIsoDate = (
  day: number,
  month: number,
  year: number,
): string | null => {
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

// Matches either "dd-mm-yyyy" (groups 1-3) or "dd monthname yyyy" (groups 4-6).
const DATE_PATTERN =
  "(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})" +
  "|(\\d{1,2})\\s+([a-z]+)\\.?\\s+(\\d{4})";

// Turns a single date match into an ISO string, or null when it is not a valid
// calendar date (e.g. an unknown month name or an impossible day/month).
const isoFromMatch = (match: RegExpExecArray): string | null => {
  if (match[1]) {
    return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  const month = MONTHS[match[5]];
  if (!month) return null;
  return toIsoDate(Number(match[4]), Number(month), Number(match[6]));
};

// The first valid date whose start sits within MAX_LABEL_TO_DATE_DISTANCE chars
// of `fromIndex` in the (already lower-cased) text, or null.
const findDateNear = (lowerText: string, fromIndex: number): string | null => {
  const haystack = lowerText.slice(fromIndex);
  const re = new RegExp(DATE_PATTERN, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(haystack)) !== null) {
    if (match.index > MAX_LABEL_TO_DATE_DISTANCE) break;
    const iso = isoFromMatch(match);
    if (iso) return iso;
  }
  return null;
};

// Scans every occurrence of the given labels (reading order) and returns the
// first date that sits just after one of them, or null.
const findDateForLabels = (
  lowerText: string,
  labels: string[],
): string | null => {
  const labelRe = new RegExp(`\\b(?:${labels.join("|")})\\b`, "g");
  let match: RegExpExecArray | null;
  while ((match = labelRe.exec(lowerText)) !== null) {
    const date = findDateNear(lowerText, match.index + match[0].length);
    if (date) return date;
  }
  return null;
};

export const extractDealDates = (
  text: string,
): { startDate: string | null; deliveryDate: string | null } => {
  const lowerText = (text ?? "").toLowerCase();
  return {
    startDate: findDateForLabels(lowerText, START_LABELS),
    deliveryDate: findDateForLabels(lowerText, DELIVERY_LABELS),
  };
};
