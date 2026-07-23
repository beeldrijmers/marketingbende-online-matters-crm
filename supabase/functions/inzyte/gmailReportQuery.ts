import type { MonthlyReportPeriod } from "./monthlyReport.ts";

const addDays = (date: string, days: number): string => {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const gmailDate = (date: string): string => date.replaceAll("-", "/");

const searchTerm = (value: string): string =>
  value
    .replace(/\[[^\]]+]/g, " ")
    .replace(/[{}"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

const websiteDomain = (value: string): string => {
  if (!value) return "";
  try {
    return new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    ).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
};

export const buildSentMailSearchQuery = ({
  companyName,
  dealName,
  website,
  createdAt,
  period,
  now = new Date(),
}: {
  companyName: string;
  dealName: string;
  website: string;
  createdAt: string;
  period: MonthlyReportPeriod;
  now?: Date;
}): string | null => {
  const terms = [
    searchTerm(companyName),
    websiteDomain(website),
    searchTerm(dealName.split("—")[0] || dealName),
  ].filter(
    (value, index, values) =>
      value.length >= 4 && values.indexOf(value) === index,
  );
  if (terms.length === 0) return null;
  const createdDate =
    createdAt && !Number.isNaN(Date.parse(createdAt))
      ? createdAt.slice(0, 10)
      : period.previousStart;
  const reportGraceEnd = addDays(period.currentEnd, 22);
  const tomorrow = addDays(now.toISOString().slice(0, 10), 1);
  const end = reportGraceEnd < tomorrow ? reportGraceEnd : tomorrow;
  const termQuery = terms.map((value) => `"${value}"`).join(" ");
  return `in:sent after:${gmailDate(createdDate)} before:${gmailDate(end)} {${termQuery}}`;
};
