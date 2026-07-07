import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { Identifier } from "ra-core";

import type { DealStage } from "../types";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  return dealStage?.label;
};

export function getRelativeTimeString(
  dateString: string,
  locale = "en",
): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const isoDateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

// Parse a YYYY-MM-DD string as local midnight. Some browsers consider a date
// in that format as UTC, which can cause off-by-one-day issues depending on
// the user's timezone; parsing the components manually avoids that. Returns
// null for missing or malformed values (date columns are nullable).
export function parseISODateStringLocal(
  dateString: string | null | undefined,
): Date | null {
  if (!dateString || !isoDateStringRegex.test(dateString)) {
    return null;
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Date columns are nullable in the database, so a missing or malformed value
// must render as "no date" instead of crashing the page.
export function formatISODateString(
  dateString: string | null | undefined,
): string | null {
  const date = parseISODateStringLocal(dateString);
  return date ? format(date, "PP", { locale: nl }) : null;
}

// Whether the given ISO date lies strictly before today (day-level, local
// timezone). A deal expected to close today is not in the past, so it must
// not get the "Verleden" badge. Missing or malformed dates return false.
export function isBeforeToday(
  dateString: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const date = parseISODateStringLocal(dateString);
  if (!date) {
    return false;
  }
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return date.getTime() < startOfToday.getTime();
}

export function buildDealInboundEmail(
  dealId: Identifier,
  inboundEmail: string | undefined,
): string | null {
  if (!inboundEmail) return null;

  const atIndex = inboundEmail.indexOf("@");
  if (atIndex === -1) return null;

  const domain = inboundEmail.slice(atIndex + 1);
  if (!domain) return null;

  return `deal-${dealId}@${domain}`;
}
