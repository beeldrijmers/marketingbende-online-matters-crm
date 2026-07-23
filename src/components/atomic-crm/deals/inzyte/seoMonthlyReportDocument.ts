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

/**
 * Removes internal product and workflow names from text that can be copied or
 * printed for a customer. The source data stays unchanged in the assignment.
 */
export const customerFacingText = (value: string): string =>
  value
    .replace(/https?:\/\/crm\.marketingbende\.nl\S*/gi, "")
    .replace(/\bCRM\s*\+\s*Inzyte\b/gi, "Online Matters")
    .replace(
      /\bCRM\s*\/\s*Trello[- ]werkzaamhedenlogboek\b/gi,
      "werkzaamhedenoverzicht",
    )
    .replace(/\bCRM[- ]logboek\b/gi, "werkzaamhedenoverzicht")
    .replace(/\bInzyte(?:\.io)?\b/gi, "ons analyseplatform")
    .replace(/\bTrello\b/gi, "het werkzaamhedenoverzicht")
    .replace(/\bGmail\b/gi, "de correspondentie")
    .replace(/\bCRM\b/gi, "het klantdossier")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();

const paragraphs = (value: string): string =>
  escapeHtml(customerFacingText(value))
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");

const statusOf = (
  report: SeoMonthlyReport,
  source: "ga4" | "searchConsole",
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
  (["ga4", "searchConsole"] as const).some(
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
}): { ready: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  if (
    !hasCompleteMeasurementPair(report) ||
    report.headline_metrics.length === 0
  ) {
    reasons.push("een volledige maand-op-maandmeting");
  }
  const safeSummary = customerFacingText(clientSummary);
  if (safeSummary.length < 40) reasons.push("een bruikbare klantsamenvatting");
  const safeWork = customerFacingText(workSummary);
  if (
    safeWork.length < 20 ||
    EMPTY_WORK_PATTERNS.some((pattern) => pattern.test(safeWork))
  ) {
    reasons.push("concrete werkzaamheden uit de meetmaand");
  }
  if (customerFacingText(interpretation).length < 30) {
    reasons.push("een praktische duiding van de ontwikkeling");
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
  const metrics = report.headline_metrics
    .map(
      (metric) =>
        `• ${metric.label}: ${metricValue(metric, metric.current)} (vorige maand ${metricValue(metric, metric.previous)}; ${changeLabel(metric)})`,
    )
    .join("\n");
  return [
    `SEO-maandrapport ${monthLabel(report.reporting_month)}`,
    `Meetperiode: ${dateLabel(report.current_start)} t/m ${dateLabel(
      report.current_end,
    )}, vergeleken met ${dateLabel(report.previous_start)} t/m ${dateLabel(
      report.previous_end,
    )}.`,
    "Kort samengevat",
    customerFacingText(clientSummary),
    "Resultaten maand-op-maand",
    metrics,
    "Wat deze ontwikkeling betekent",
    customerFacingText(interpretation),
    "Wat we deze maand hebben uitgevoerd",
    customerFacingText(workSummary),
    "Eerlijke aandachtspunten",
    customerFacingText(caveats),
    "Vooruitblik",
    customerFacingText(nextSteps),
    "Toelichting: de cijfers tonen de ontwikkeling tussen twee kalendermaanden. Seizoensinvloeden, campagnes, concurrentie en andere externe factoren kunnen het resultaat mede beïnvloeden; één wijziging is daarom niet automatisch de enige oorzaak.",
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
  const accent = isOnlineMatters ? "#59c900" : "#2563eb";
  const dark = isOnlineMatters ? "#12372d" : "#172033";
  const soft = isOnlineMatters ? "#f1faeb" : "#eff6ff";
  const metrics = report.headline_metrics
    .slice(0, 8)
    .map(
      (metric) => `
        <article class="metric">
          <div class="metric-top">
            <span>${escapeHtml(metric.label)}</span>
            <em class="${metric.favourable === true ? "good" : metric.favourable === false ? "bad" : "neutral"}">${escapeHtml(changeLabel(metric))}</em>
          </div>
          <strong>${escapeHtml(metricValue(metric, metric.current))}</strong>
          <small>Vorige maand: ${escapeHtml(metricValue(metric, metric.previous))}</small>
          <div class="metric-kind">${metric.group === "seo" ? "Organische vindbaarheid" : "Websiteontwikkeling"}</div>
        </article>`,
    )
    .join("");
  const brandHeader = isOnlineMatters
    ? `<img class="logo" src="${ONLINE_MATTERS_LOGO_URL}" alt="Online Matters" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'"><span class="brand-fallback">Online Matters</span>`
    : '<span class="neutral-brand">SEO maandrapport</span>';

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SEO-maandrapport ${escapeHtml(companyName)} · ${escapeHtml(monthLabel(report.reporting_month))}</title>
<style>
:root{--accent:${accent};--dark:${dark};--soft:${soft};--ink:#1d2925;--muted:#66736e;--line:#dce5e1}
@page{size:A4;margin:10mm 13mm 11mm}*{box-sizing:border-box}html{background:#eef2f0}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:0;line-height:1.45;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}main{max-width:900px;margin:0 auto;padding:0}.topbar{height:6px;background:linear-gradient(90deg,var(--accent),#a4ec52 62%,#d7f5ba);border-radius:0 0 8px 8px}.brand-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:12px 0 10px;border-bottom:1px solid var(--line)}.brand-wrap{display:flex;align-items:center;min-height:29px}.logo{display:block;width:190px;height:auto}.brand-fallback{display:none;color:var(--dark);font-size:21px;font-weight:800}.neutral-brand{color:var(--dark);font-weight:800;text-transform:uppercase;letter-spacing:.12em}.report-label{font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}.hero{padding:14px 0 12px;display:grid;grid-template-columns:1.4fr .6fr;gap:24px;align-items:end}.eyebrow{color:#328300;text-transform:uppercase;letter-spacing:.13em;font-size:9px;font-weight:800;margin:0 0 5px}.hero h1{font-size:27px;line-height:1.06;color:var(--dark);margin:0}.client{font-size:14px;font-weight:700;margin-top:5px}.period-card{background:var(--soft);border-left:4px solid var(--accent);border-radius:9px;padding:9px 12px}.period-card strong,.period-card span{display:block}.period-card strong{font-size:11px;color:var(--dark)}.period-card span{font-size:9px;color:var(--muted);margin-top:2px}.summary{background:var(--dark);color:#fff;border-radius:13px;padding:13px 17px;margin-bottom:10px;break-inside:avoid}.summary .eyebrow{color:#a9ed68}.summary h2{font-size:16px;margin:0 0 5px}.summary p{font-size:9.5px;margin:0 0 5px;color:#f0f6f3}.summary p:last-child{margin-bottom:0}.section-title{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:11px 0 6px}.section-title h2{font-size:15px;color:var(--dark);margin:0}.section-title span{font-size:8px;color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.metric{position:relative;border:1px solid var(--line);border-radius:9px;padding:7px 8px;break-inside:avoid;background:#fff}.metric-top{display:flex;align-items:flex-start;justify-content:space-between;gap:4px}.metric span,.metric small{font-size:7.8px;color:var(--muted)}.metric strong{display:block;color:var(--dark);font-size:17px;line-height:1.05;margin:3px 0 1px}.metric em{font-size:7.5px;font-style:normal;font-weight:800;border-radius:999px;padding:1px 4px;white-space:nowrap}.metric .good{color:#2f7d14;background:#edf9e8}.metric .bad{color:#b42318;background:#fff0ee}.metric .neutral{color:var(--muted);background:#f1f3f2}.metric-kind{font-size:6.8px;text-transform:uppercase;letter-spacing:.06em;color:#328300;font-weight:800;margin-top:4px}.insight{margin-top:9px;border-left:4px solid var(--accent);background:#f7faf8;border-radius:9px;padding:9px 12px;break-inside:avoid}.insight h2,.content h2,.caveats h2{font-size:13px;color:var(--dark);margin:0 0 5px}.insight p,.content p,.caveats p{font-size:9px;margin:0 0 5px}.insight p:last-child,.content p:last-child,.caveats p:last-child{margin-bottom:0}.content-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px;break-inside:avoid}.content{border:1px solid var(--line);border-radius:11px;padding:9px 11px;break-inside:avoid}.content.work{border-top:3px solid var(--accent)}.content.next{background:var(--soft);border-color:#cfe9c1}.caveats{margin-top:7px;border:1px solid #ecd9b0;background:#fffaf0;border-radius:10px;padding:8px 11px;break-inside:avoid}.caveats h2{color:#75530b}.note{font-size:7.4px;line-height:1.35;color:var(--muted);margin-top:7px;padding:6px 8px;background:#f5f7f6;border-radius:7px}footer{display:flex;justify-content:space-between;gap:16px;margin-top:7px;padding-top:5px;border-top:1px solid var(--line);font-size:7.5px;color:var(--muted)}footer strong{color:var(--dark)}
@media(max-width:640px){.hero,.content-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.brand-row{align-items:flex-start}.logo{width:170px}}
@media print{html{background:#fff}.summary,.metric,.content{break-inside:avoid}}
</style></head><body><main>
<div class="topbar"></div>
<header class="brand-row"><div class="brand-wrap">${brandHeader}</div><div class="report-label">SEO · maandrapport</div></header>
<section class="hero"><div><p class="eyebrow">Maandelijkse voortgang</p><h1>${escapeHtml(monthLabel(report.reporting_month))}</h1><div class="client">${escapeHtml(companyName)}</div></div><div class="period-card"><strong>${escapeHtml(dateLabel(report.current_start))} – ${escapeHtml(dateLabel(report.current_end))}</strong><span>Vergeleken met ${escapeHtml(monthLabel(report.previous_start))}</span></div></section>
<section class="summary"><p class="eyebrow">De belangrijkste conclusie</p><h2>Kort samengevat</h2>${paragraphs(clientSummary)}</section>
<div class="section-title"><h2>Resultaten maand-op-maand</h2><span>Huidige maand tegenover vorige maand</span></div><section class="metrics">${metrics}</section>
<section class="insight"><h2>Wat deze ontwikkeling betekent</h2>${paragraphs(interpretation)}</section>
<section class="content-grid"><article class="content work"><h2>Wat we deze maand hebben uitgevoerd</h2>${paragraphs(workSummary)}</article><article class="content next"><h2>Vooruitblik</h2>${paragraphs(nextSteps)}</article></section>
<section class="caveats"><h2>Eerlijke aandachtspunten</h2>${paragraphs(caveats)}</section>
<div class="note">De cijfers tonen de ontwikkeling tussen twee kalendermaanden. Seizoensinvloeden, campagnes, concurrentie en andere externe factoren kunnen het resultaat mede beïnvloeden. Eén afzonderlijke wijziging is daarom niet automatisch de enige oorzaak van een stijging of daling.</div>
<footer>${isOnlineMatters ? "<strong>Online Matters</strong><span>onlinematters.nl</span>" : "<strong>SEO-maandrapport</strong><span>Vertrouwelijk</span>"}</footer>
</main><script>window.addEventListener("load",()=>{if(new URLSearchParams(window.location.search).get("autoprint")==="0")return;const images=Array.from(document.images);const imageReady=Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener("load",resolve,{once:true});image.addEventListener("error",resolve,{once:true})})));const fontReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();Promise.all([imageReady,fontReady]).then(()=>setTimeout(()=>window.print(),120))});</script></body></html>`;
};
