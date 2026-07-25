import type { SeoMonthlyHeadlineMetric, SeoMonthlyReport } from "../../types";

export type SeoReportBrand = "online_matters" | "neutral";

export const ONLINE_MATTERS_LOGO_URL =
  "https://onlinematters.nl/wp-content/uploads/2023/03/Logo-RGB-500x79.png";

const MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const monthLabel = (date: string): string =>
  MONTH_FORMATTER.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));

export const dateLabel = (date: string): string =>
  DATE_FORMATTER.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

export const metricValue = (
  metric: SeoMonthlyHeadlineMetric,
  value: number,
): string => {
  if (metric.format === "percent") {
    return `${value.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
  }
  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: metric.format === "decimal" ? 1 : 0,
  });
};

export const changeLabel = (metric: SeoMonthlyHeadlineMetric): string => {
  if (metric.changePercent === null) return "Nieuw meetpunt";
  if (metric.key === "position") {
    const value = Math.abs(metric.changePercent).toLocaleString("nl-NL", {
      maximumFractionDigits: 1,
    });
    return metric.favourable === true
      ? `${value}% beter`
      : metric.favourable === false
        ? `${value}% minder gunstig`
        : "Ongewijzigd";
  }
  const sign = metric.changePercent > 0 ? "+" : "";
  return `${sign}${metric.changePercent.toLocaleString("nl-NL", {
    maximumFractionDigits: 1,
  })}%`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const CUSTOMER_INTERNAL_URL =
  /https?:\/\/(?:crm\.marketingbende\.nl|trello\.com|inzyte\.io)\S*/gi;
const CUSTOMER_EMAIL_ADDRESS = /\b[\w.+%-]+@[\w.-]+\.[a-z]{2,}\b/gi;
const CUSTOMER_CREDENTIAL_BLOCK_LABEL =
  /^\s*(?:inlog(?:gegevens)?|login(?:gegevens)?|credentials?|auth(?:enticatie)?|wp[- ]?admin)(?:\s+[^:\n]{0,50})?\s*:\s*$/i;
const CUSTOMER_CREDENTIAL_VALUE_LABEL =
  /^\s*(?:inlog(?:gegevens)?|login|gebruikersnaam|user(?:name)?|wachtwoord|password|api[- _]?key|secret|token|wp[- ]?admin)\s*:\s*\S+/i;
const CUSTOMER_SECRETISH_VALUE =
  /^(?=.{10,180}$)(?=\S+$)(?=.*[a-z])(?=.*(?:\d|[^a-z0-9])).+$/i;
const REPORT_BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * Removes internal product and workflow names from text that can be copied or
 * printed for a customer. The source data stays unchanged in the assignment.
 */
export const customerFacingText = (value: string): string => {
  const text = value
    .replace(CUSTOMER_INTERNAL_URL, "")
    .replace(CUSTOMER_EMAIL_ADDRESS, "[e-mailadres]")
    .replace(/\bCRM\s*\+\s*Inzyte\b/gi, "Online Matters")
    .replace(
      /\bCRM\s*\/\s*Trello[- ]werkzaamhedenlogboek\b/gi,
      "werkzaamhedenoverzicht",
    )
    .replace(/\bCRM[- ]logboek\b/gi, "werkzaamhedenoverzicht")
    .replace(/\bInzyte(?:\.io)?\b/gi, "ons analyseplatform")
    .replace(/\bTrello\b/gi, "het werkzaamhedenoverzicht")
    .replace(/\bGmail\b/gi, "de correspondentie")
    .replace(/\bCRM\b/gi, "het klantdossier");
  const safeLines: string[] = [];
  let skipSensitiveLines = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (skipSensitiveLines > 0) {
      skipSensitiveLines -= 1;
      continue;
    }
    if (CUSTOMER_CREDENTIAL_BLOCK_LABEL.test(line)) {
      skipSensitiveLines = 3;
      continue;
    }
    if (CUSTOMER_CREDENTIAL_VALUE_LABEL.test(line)) continue;
    if (CUSTOMER_SECRETISH_VALUE.test(line) && !/^https?:\/\//i.test(line)) {
      continue;
    }
    safeLines.push(line);
  }
  return safeLines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
};

const reportContent = (value: string): string =>
  customerFacingText(value)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 0 && lines.every((line) => REPORT_BULLET.test(line))) {
        return `<ul>${lines
          .map(
            (line) => `<li>${escapeHtml(line.replace(REPORT_BULLET, ""))}</li>`,
          )
          .join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");

const statusOf = (
  report: SeoMonthlyReport,
  source: "ga4" | "searchConsole" | "businessProfile" | "googleAds",
  period: "current" | "previous",
): string | undefined => {
  const sources = report.report_data?.sources;
  const sourceData =
    sources && typeof sources === "object"
      ? (sources[source] as Record<string, unknown> | undefined)
      : undefined;
  const periodData =
    sourceData && typeof sourceData === "object"
      ? (sourceData[period] as Record<string, unknown> | undefined)
      : undefined;
  return typeof periodData?.status === "string" ? periodData.status : undefined;
};

export const hasCompleteMeasurementPair = (report: SeoMonthlyReport): boolean =>
  (["ga4", "searchConsole", "businessProfile", "googleAds"] as const).some(
    (source) =>
      statusOf(report, source, "current") === "success" &&
      statusOf(report, source, "previous") === "success",
  );

export const getSeoReportBrand = (report: SeoMonthlyReport): SeoReportBrand =>
  report.report_data?.presentation?.brand === "neutral"
    ? "neutral"
    : "online_matters";

const EMPTY_WORK_PATTERNS = [
  /geen afgeronde werkzaamheden/i,
  /geen werkzaamheden geregistreerd/i,
  /vul (?:hier )?.*werkzaamheden/i,
];

export const getCustomerReportReadiness = ({
  report: _report,
  clientSummary,
  interpretation,
  workSummary,
  caveats,
  nextSteps,
}: {
  report: SeoMonthlyReport;
  clientSummary: string;
  interpretation: string;
  workSummary: string;
  caveats: string;
  nextSteps: string;
}): { ready: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const safeSummary = customerFacingText(clientSummary);
  if (safeSummary.length < 40) reasons.push("een bruikbare klantsamenvatting");
  const safeWork = customerFacingText(workSummary);
  if (
    safeWork.length < 20 ||
    EMPTY_WORK_PATTERNS.some((pattern) => pattern.test(safeWork))
  ) {
    reasons.push("concrete werkzaamheden uit de rapportagemaand");
  }
  if (customerFacingText(interpretation).length < 30) {
    reasons.push("een praktische duiding van de voortgang");
  }
  if (customerFacingText(caveats).length < 20) {
    reasons.push("eerlijke aandachtspunten");
  }
  if (customerFacingText(nextSteps).length < 20) {
    reasons.push("concrete vervolgstappen voor komende maand");
  }
  return { ready: reasons.length === 0, reasons };
};

export const buildSeoMonthlyReportText = ({
  report,
  clientSummary,
  interpretation,
  workSummary,
  caveats,
  nextSteps,
}: {
  report: SeoMonthlyReport;
  clientSummary: string;
  interpretation: string;
  workSummary: string;
  caveats: string;
  nextSteps: string;
}): string => {
  const hasMeasurement =
    hasCompleteMeasurementPair(report) && report.headline_metrics.length > 0;
  const metrics = report.headline_metrics
    .map(
      (metric) =>
        `• ${metric.label}: ${metricValue(metric, metric.current)} (vorige maand ${metricValue(metric, metric.previous)}; ${changeLabel(metric)})`,
    )
    .join("\n");
  return [
    `Maandrapportage ${monthLabel(report.reporting_month)}`,
    hasMeasurement
      ? `Meetperiode: ${dateLabel(report.current_start)} t/m ${dateLabel(
          report.current_end,
        )}, vergeleken met ${dateLabel(report.previous_start)} t/m ${dateLabel(
          report.previous_end,
        )}.`
      : `Rapportageperiode: ${dateLabel(report.current_start)} t/m ${dateLabel(
          report.current_end,
        )}.`,
    "Kort samengevat",
    customerFacingText(clientSummary),
    ...(hasMeasurement
      ? ["Meetresultaten maand-op-maand", metrics]
      : [
          "Meetbeperking",
          "Voor deze rapportage was geen volledige gecontroleerde maand-op-maandmeting beschikbaar. Daarom bevat deze versie geen uitspraken over het effect op verkeer, vindbaarheid, advertenties of conversies.",
        ]),
    hasMeasurement
      ? "Wat deze ontwikkeling betekent"
      : "Wat deze voortgang betekent",
    customerFacingText(interpretation),
    "Wat we deze maand hebben uitgevoerd",
    customerFacingText(workSummary),
    "Eerlijke aandachtspunten",
    customerFacingText(caveats),
    "Vooruitblik",
    customerFacingText(nextSteps),
    hasMeasurement
      ? "Toelichting: de cijfers tonen de ontwikkeling tussen twee kalendermaanden. Seizoensinvloeden, campagnes, concurrentie en andere externe factoren kunnen het resultaat mede beïnvloeden; één wijziging is daarom niet automatisch de enige oorzaak."
      : "Toelichting: deze rapportage verantwoordt het vastgelegde werk en de voortgang. Zonder volledige gecontroleerde meetreeks kunnen hier geen betrouwbare resultaatclaims aan worden verbonden.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const buildSeoMonthlyReportDocument = ({
  report,
  companyName,
  clientSummary,
  interpretation,
  workSummary,
  caveats,
  nextSteps,
  brand,
}: {
  report: SeoMonthlyReport;
  companyName: string;
  clientSummary: string;
  interpretation: string;
  workSummary: string;
  caveats: string;
  nextSteps: string;
  brand: SeoReportBrand;
}): string => {
  const isOnlineMatters = brand === "online_matters";
  const hasMeasurement =
    hasCompleteMeasurementPair(report) && report.headline_metrics.length > 0;
  const accent = isOnlineMatters ? "#59c900" : "#2563eb";
  const dark = isOnlineMatters ? "#12372d" : "#172033";
  const soft = isOnlineMatters ? "#f1faeb" : "#eff6ff";
  const pdfMetricLabel = (metric: SeoMonthlyHeadlineMetric): string =>
    ({
      adsClicks: "Klikken",
      adsImpressions: "Vertoningen",
      adsConversions: "Conversies",
      businessProfileViews: "Profielweergaven",
      businessProfileWebsiteClicks: "Websiteklikken",
      businessProfileCalls: "Belacties",
      businessProfileDirections: "Routeaanvragen",
    })[metric.key] || metric.label;
  const metricCard = (metric: SeoMonthlyHeadlineMetric): string => `
        <article class="metric">
          <div class="metric-top">
            <span>${escapeHtml(pdfMetricLabel(metric))}</span>
            <em class="${metric.favourable === true ? "good" : metric.favourable === false ? "bad" : "neutral"}">${escapeHtml(changeLabel(metric))}</em>
          </div>
          <strong>${escapeHtml(metricValue(metric, metric.current))}</strong>
          <small>Vorige maand: ${escapeHtml(metricValue(metric, metric.previous))}</small>
          <div class="metric-kind">${escapeHtml(metric.source)}</div>
        </article>`;
  const metricSection = (
    group: SeoMonthlyHeadlineMetric["group"],
    label: string,
  ): string => {
    const metrics = report.headline_metrics.filter(
      (metric) => metric.group === group,
    );
    return metrics.length
      ? `<section class="metric-group"><h3>${label}</h3><div class="metrics">${metrics.map(metricCard).join("")}</div></section>`
      : "";
  };
  const primaryMetricSections = (
    [
      ["seo", "Organische vindbaarheid"],
      ["website_context", "Websitecontext"],
    ] as const
  )
    .map(([group, label]) => metricSection(group, label))
    .filter(Boolean)
    .join("");
  const channelMetricSections = (
    [
      ["ads", "Advertenties"],
      ["local", "Lokale zichtbaarheid"],
    ] as const
  )
    .map(([group, label]) => metricSection(group, label))
    .filter(Boolean)
    .join("");
  const metricSections = `${primaryMetricSections}${
    channelMetricSections
      ? `<div class="channel-metric-groups">${channelMetricSections}</div>`
      : ""
  }`;
  const brandHeader = isOnlineMatters
    ? `<img class="logo" src="${ONLINE_MATTERS_LOGO_URL}" alt="Online Matters" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'"><span class="brand-fallback">Online Matters</span>`
    : '<span class="neutral-brand">Maandrapportage</span>';
  const measurementSection = hasMeasurement
    ? `<section class="measurement"><div class="section-title"><h2>Meetresultaten maand-op-maand</h2><span>Huidige kalendermaand tegenover vorige kalendermaand</span></div>${metricSections}</section>`
    : `<section class="measurement-note"><h2>Voortgang zonder meetkoppeling</h2><p>Voor deze rapportage was geen volledige gecontroleerde maand-op-maandmeting beschikbaar. Daarom bevat deze versie bewust geen uitspraken over het effect op verkeer, vindbaarheid, advertenties of conversies.</p></section>`;
  const periodDetail = hasMeasurement
    ? `Vergeleken met ${escapeHtml(monthLabel(report.previous_start))}`
    : "Rapportage over deze kalendermaand";
  const interpretationTitle = hasMeasurement
    ? "Wat deze ontwikkeling betekent"
    : "Wat deze voortgang betekent";
  const reportNote = hasMeasurement
    ? "De cijfers tonen de ontwikkeling tussen twee kalendermaanden. Seizoensinvloeden, campagnes, concurrentie en andere externe factoren kunnen het resultaat mede beïnvloeden. Eén afzonderlijke wijziging is daarom niet automatisch de enige oorzaak van een stijging of daling."
    : "Deze rapportage verantwoordt het vastgelegde werk en de voortgang. Zonder volledige gecontroleerde meetreeks kunnen hier geen betrouwbare resultaatclaims aan worden verbonden.";

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maandrapportage ${escapeHtml(customerFacingText(companyName))} · ${escapeHtml(monthLabel(report.reporting_month))}</title>
<style>
:root{--accent:${accent};--dark:${dark};--soft:${soft};--ink:#1d2925;--muted:#66736e;--line:#dce5e1}
@page{size:A4;margin:14mm 15mm 16mm}
*{box-sizing:border-box}
html{background:#eef2f0}
body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:0;line-height:1.55;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow-wrap:anywhere}
main{max-width:900px;margin:0 auto;padding:0}
.topbar{height:5px;background:linear-gradient(90deg,var(--accent),#a4ec52 62%,#d7f5ba);border-radius:0 0 8px 8px}
.brand-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:15px 0 12px;border-bottom:1px solid var(--line)}
.brand-wrap{display:flex;align-items:center;min-height:32px}
.logo{display:block;width:190px;height:auto}
.brand-fallback{display:none;color:var(--dark);font-size:21px;font-weight:800}
.neutral-brand{color:var(--dark);font-weight:800;text-transform:uppercase;letter-spacing:.12em}
.report-label{font-size:9pt;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.hero{padding:18px 0 16px;display:grid;grid-template-columns:1.35fr .65fr;gap:28px;align-items:end}
.eyebrow{color:#328300;text-transform:uppercase;letter-spacing:.13em;font-size:8.5pt;font-weight:800;margin:0 0 6px}
.hero h1{font-size:28pt;line-height:1.08;color:var(--dark);margin:0}
.client{font-size:14pt;font-weight:700;margin-top:6px}
.period-card{background:var(--soft);border-left:4px solid var(--accent);border-radius:10px;padding:11px 13px}
.period-card strong,.period-card span{display:block}
.period-card strong{font-size:10pt;color:var(--dark)}
.period-card span{font-size:8.5pt;color:var(--muted);margin-top:3px}
.summary{background:var(--dark);color:#fff;border-radius:14px;padding:16px 19px;margin-bottom:16px;break-inside:avoid-page}
.summary .eyebrow{color:#a9ed68}
.summary h2{font-size:16pt;margin:0 0 7px}
.summary p,.summary li{font-size:10pt;color:#f0f6f3}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:17px 0 8px}
.section-title h2{font-size:16pt;color:var(--dark);margin:0}
.section-title span{max-width:47%;font-size:8.5pt;line-height:1.35;text-align:right;color:var(--muted)}
.measurement{break-before:auto}
.metric-group{margin-top:10px}
.metric-group h3{font-size:10pt;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 6px;break-after:avoid-page}
.channel-metric-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
.channel-metric-groups .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
.channel-metric-groups>.metric-group:only-child{grid-column:1/-1}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.measurement-note{margin-top:12px;border:1px solid #cfe2ec;background:#f3faff;border-radius:11px;padding:12px 14px;break-inside:avoid-page}
.measurement-note h2{font-size:14pt;color:var(--dark);margin:0 0 5px}
.measurement-note p{font-size:10pt;margin:0}
.metric{position:relative;border:1px solid var(--line);border-radius:10px;padding:10px 11px;break-inside:avoid-page;background:#fff}
.metric-top{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
.metric span,.metric small{font-size:8.5pt;color:var(--muted)}
.metric strong{display:block;color:var(--dark);font-size:19pt;line-height:1.1;margin:5px 0 2px}
.metric em{font-size:8pt;font-style:normal;font-weight:800;border-radius:999px;padding:2px 5px;white-space:nowrap}
.metric .good{color:#2f7d14;background:#edf9e8}
.metric .bad{color:#b42318;background:#fff0ee}
.metric .neutral{color:var(--muted);background:#f1f3f2}
.metric-kind{font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#328300;font-weight:800;margin-top:5px}
.insight,.content,.caveats{margin-top:13px;border-radius:11px;padding:13px 15px;break-inside:avoid-page}
.insight{border-left:4px solid var(--accent);background:#f7faf8}
.content{border:1px solid var(--line)}
.content.work{border-top:3px solid var(--accent)}
.content.next{background:var(--soft);border-color:#cfe9c1}
.caveats{border:1px solid #ecd9b0;background:#fffaf0}
.insight h2,.content h2,.caveats h2{font-size:14pt;color:var(--dark);margin:0 0 7px}
.caveats h2{color:#75530b}
.insight p,.content p,.caveats p,.insight li,.content li,.caveats li{font-size:10pt;margin-top:0}
p{margin:0 0 7px}
p:last-child{margin-bottom:0}
ul{margin:4px 0 0;padding-left:18px}
li{margin:0 0 5px;padding-left:2px}
li:last-child{margin-bottom:0}
.methodology{font-size:8.5pt!important;line-height:1.45;color:var(--muted);margin-top:10px!important;padding-top:9px;border-top:1px solid #eadfca}
footer{display:flex;justify-content:space-between;gap:16px;margin-top:13px;padding-top:8px;border-top:1px solid var(--line);font-size:8.5pt;color:var(--muted)}
footer strong{color:var(--dark)}
.work-only{line-height:1.48}
.work-only .brand-row{padding:11px 0 9px}
.work-only .hero{padding:13px 0 11px}
.work-only .summary{padding:13px 16px;margin-bottom:9px}
.work-only .summary p,.work-only .summary li,.work-only .measurement-note p,.work-only .insight p,.work-only .content p,.work-only .caveats p,.work-only .insight li,.work-only .content li,.work-only .caveats li{font-size:9.5pt}
.work-only .measurement-note{margin:8px 1% 0 0}
.work-only .insight,.work-only .content,.work-only .caveats{margin-top:8px}
.work-only .measurement-note,.work-only .insight,.work-only .content,.work-only .caveats{padding:10px 13px}
.work-only .insight h2,.work-only .content h2,.work-only .caveats h2{font-size:13pt;margin-bottom:5px}
.work-only .methodology{font-size:8pt!important;margin-top:7px!important;padding-top:7px}
.work-only li{margin-bottom:3px}
.work-only .measurement-note,.work-only .insight,.work-only .content.work,.work-only .content.next{display:inline-block;width:49%;vertical-align:top}
.work-only .content.work{margin-right:1%}
@media(max-width:640px){.hero,.channel-metric-groups{grid-template-columns:1fr}.metrics,.channel-metric-groups .metrics{grid-template-columns:1fr}.brand-row{align-items:flex-start}.logo{width:170px}.section-title{display:block}.section-title span{display:block;max-width:none;text-align:left;margin-top:3px}.work-only .measurement-note,.work-only .insight,.work-only .content.work,.work-only .content.next{display:block;width:auto;margin-right:0}}
@media print{html{background:#fff}.summary,.metric,.content,.insight,.caveats{break-inside:avoid-page}footer{display:none}}
</style></head><body class="${hasMeasurement ? "with-measurement" : "work-only"}"><main>
<div class="topbar"></div>
<header class="brand-row"><div class="brand-wrap">${brandHeader}</div><div class="report-label">Maandrapportage</div></header>
<section class="hero"><div><p class="eyebrow">Maandelijkse voortgang</p><h1>${escapeHtml(monthLabel(report.reporting_month))}</h1><div class="client">${escapeHtml(customerFacingText(companyName))}</div></div><div class="period-card"><strong>${escapeHtml(dateLabel(report.current_start))} - ${escapeHtml(dateLabel(report.current_end))}</strong><span>${periodDetail}</span></div></section>
<section class="summary"><p class="eyebrow">De belangrijkste conclusie</p><h2>Kort samengevat</h2>${reportContent(clientSummary)}</section>
${measurementSection}
<section class="insight"><h2>${interpretationTitle}</h2>${reportContent(interpretation)}</section>
<section class="content work"><h2>Wat we deze maand hebben uitgevoerd</h2>${reportContent(workSummary)}</section>
<section class="content next"><h2>Vooruitblik</h2>${reportContent(nextSteps)}</section>
<section class="caveats"><h2>Eerlijke aandachtspunten</h2>${reportContent(caveats)}<p class="methodology">${reportNote}</p></section>
<footer>${isOnlineMatters ? "<strong>Online Matters</strong><span>onlinematters.nl</span>" : "<strong>Maandrapportage</strong><span>Vertrouwelijk</span>"}</footer>
</main><script>window.addEventListener("load",()=>{if(new URLSearchParams(window.location.search).get("autoprint")==="0")return;const images=Array.from(document.images);const imageReady=Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener("load",resolve,{once:true});image.addEventListener("error",resolve,{once:true})})));const fontReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();Promise.all([imageReady,fontReady]).then(()=>setTimeout(()=>window.print(),120))});</script></body></html>`;
};
