import { useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Clipboard,
  FileBarChart,
  FileDown,
  History,
  Loader2,
  RefreshCw,
  SearchCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  Deal,
  SeoMonthlyHeadlineMetric,
  SeoMonthlyReport,
} from "../../types";
import type { InzyteWorkspaceController } from "./useInzyteWorkspaceController";

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

const monthLabel = (date: string): string =>
  MONTH_FORMATTER.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));

const dateLabel = (date: string): string =>
  DATE_FORMATTER.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

const maxReportingMonth = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const metricValue = (
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

const changeLabel = (metric: SeoMonthlyHeadlineMetric): string => {
  if (metric.changePercent === null) return "Geen vergelijkingspercentage";
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

const paragraphs = (value: string): string =>
  escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");

const reportText = ({
  report,
  clientSummary,
  workSummary,
  nextSteps,
}: {
  report: SeoMonthlyReport;
  clientSummary: string;
  workSummary: string;
  nextSteps: string;
}): string => {
  const metrics = report.headline_metrics
    .map(
      (metric) =>
        `• ${metric.label}: ${metricValue(metric, metric.current)} (vorige maand ${metricValue(metric, metric.previous)}; ${changeLabel(metric)}${metric.group === "website_context" ? "; websitecontext" : ""})`,
    )
    .join("\n");
  return [
    report.title,
    `Meetperiode: ${dateLabel(report.current_start)} t/m ${dateLabel(
      report.current_end,
    )}, vergeleken met ${dateLabel(report.previous_start)} t/m ${dateLabel(
      report.previous_end,
    )}.`,
    "Samenvatting",
    clientSummary,
    "Meetresultaten",
    metrics || "Geen vergelijkbare kerncijfers beschikbaar.",
    "Werkzaamheden in deze meetmaand",
    workSummary,
    "Volgende stappen",
    nextSteps,
    "Toelichting: de cijfers tonen maand-op-maand ontwikkeling. Ze bewijzen op zichzelf geen direct oorzakelijk verband met één afzonderlijke SEO-wijziging; kalendermaanden kunnen bovendien in lengte verschillen.",
  ].join("\n\n");
};

const printDocument = ({
  report,
  companyName,
  clientSummary,
  workSummary,
  nextSteps,
}: {
  report: SeoMonthlyReport;
  companyName: string;
  clientSummary: string;
  workSummary: string;
  nextSteps: string;
}): string => {
  const metrics = report.headline_metrics
    .map(
      (metric) => `
        <article class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metricValue(metric, metric.current))}</strong>
          <small>vorige maand ${escapeHtml(metricValue(metric, metric.previous))}</small>
          <small class="scope">${metric.group === "seo" ? "SEO-kerncijfer" : "Websitecontext"} · ${escapeHtml(metric.source)}</small>
          <div class="definition">${escapeHtml(metric.definition)}</div>
          <em class="${metric.favourable === true ? "good" : metric.favourable === false ? "bad" : "neutral"}">${escapeHtml(changeLabel(metric))}</em>
        </article>`,
    )
    .join("");
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#162033;margin:0;line-height:1.5}header{border-bottom:3px solid #0ea5e9;padding-bottom:18px;margin-bottom:24px}.brand{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0284c7;font-weight:800}h1{font-size:28px;line-height:1.15;margin:7px 0 4px}h2{font-size:17px;margin:26px 0 8px}.muted{color:#64748b}.period{margin-top:7px;font-size:13px}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.metric{border:1px solid #dbe4ee;border-radius:10px;padding:12px;position:relative;break-inside:avoid}.metric span,.metric small{display:block;color:#64748b;font-size:11px}.metric strong{font-size:22px;display:block;margin:4px 0}.metric .scope{margin-top:5px;color:#0284c7;font-weight:700}.metric .definition{margin-top:6px;color:#64748b;font-size:10px}.metric em{position:absolute;right:12px;top:12px;font-size:11px;font-style:normal;font-weight:700}.good{color:#059669}.bad{color:#dc2626}.neutral{color:#64748b}.section{border:1px solid #e2e8f0;border-radius:12px;padding:15px 17px;margin-top:12px}.section p{margin:0 0 9px}.section p:last-child{margin-bottom:0}.evidence{display:flex;gap:10px;margin-top:10px}.pill{font-size:11px;background:#f1f5f9;border-radius:999px;padding:5px 9px}footer{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px}.disclaimer{background:#f8fafc;padding:10px;border-radius:8px;margin-top:18px;font-size:10px;color:#64748b}@media print{button{display:none}}
</style></head><body>
<header><div class="brand">Marketingbende · SEO maandupdate</div><h1>${escapeHtml(companyName)}</h1><div class="muted">${escapeHtml(report.title)}</div><div class="period">${escapeHtml(dateLabel(report.current_start))} t/m ${escapeHtml(dateLabel(report.current_end))} · vergelijking met ${escapeHtml(monthLabel(report.previous_start))}</div></header>
<h2>Samenvatting</h2><div class="section">${paragraphs(clientSummary)}</div>
<h2>Resultaten maand-op-maand</h2><p class="muted">SEO-kerncijfers komen uit Search Console of organisch GA4-verkeer. Algemene GA4-cijfers staan apart als websitecontext.</p><div class="metrics">${metrics || '<div class="muted">Voor deze periode zijn nog geen vergelijkbare kerncijfers beschikbaar.</div>'}</div>
<h2>Uitgevoerde werkzaamheden</h2><div class="section">${paragraphs(workSummary)}</div>
<div class="evidence"><span class="pill">${report.current_work_count} werkzaamheden deze maand</span><span class="pill">${report.all_time_work_count} werkzaamheden all-time</span></div>
<h2>Volgende stappen</h2><div class="section">${paragraphs(nextSteps)}</div>
<div class="disclaimer">De gerapporteerde cijfers tonen ontwikkeling en samenhang. Ze bewijzen op zichzelf geen direct oorzakelijk verband tussen één afzonderlijke wijziging en het gemeten resultaat. Kalendermaanden kunnen daarnaast één tot drie meetdagen in lengte verschillen.</div>
<footer>Gegenereerd vanuit CRM + Inzyte op ${escapeHtml(new Date(report.generated_at).toLocaleString("nl-NL"))}. Databronnen: GA4 en/of Google Search Console, afhankelijk van de klantkoppelingen.</footer>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
};

const sourceState = (
  report: SeoMonthlyReport,
  source: "ga4" | "searchConsole",
): { ok: boolean; label: string } => {
  const sources = report.report_data?.sources as
    | Record<
        string,
        { current?: { status?: string }; previous?: { status?: string } }
      >
    | undefined;
  const current = sources?.[source]?.current?.status;
  const previous = sources?.[source]?.previous?.status;
  return current === "success" && previous === "success"
    ? { ok: true, label: "Beide maanden gemeten" }
    : { ok: false, label: "Bron onvolledig" };
};

const activityText = (activity: Record<string, unknown>): string =>
  typeof activity.text === "string" ? activity.text : "Notitie zonder tekst";

const activityDate = (activity: Record<string, unknown>): string | null =>
  typeof activity.date === "string" ? activity.date : null;

const MetricCard = ({ metric }: { metric: SeoMonthlyHeadlineMetric }) => {
  const Icon =
    metric.favourable === true
      ? TrendingUp
      : metric.favourable === false
        ? TrendingDown
        : SearchCheck;
  return (
    <article className="rounded-xl border bg-background p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {metric.label}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {metricValue(metric, metric.current)}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1",
            metric.favourable === true &&
              "border-emerald-500/40 text-emerald-600",
            metric.favourable === false && "border-rose-500/40 text-rose-600",
          )}
        >
          <Icon className="size-3.5" /> {changeLabel(metric)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Vorige maand: {metricValue(metric, metric.previous)}</span>
        <Badge variant="secondary" className="text-[10px]">
          {metric.group === "seo" ? "SEO-kerncijfer" : "Websitecontext"}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {metric.definition} Bron: {metric.source}.
      </p>
    </article>
  );
};

const ReportPreview = ({
  report,
  companyName,
  clientSummary,
  setClientSummary,
  workSummary,
  setWorkSummary,
  nextSteps,
  setNextSteps,
}: {
  report: SeoMonthlyReport;
  companyName: string;
  clientSummary: string;
  setClientSummary: (value: string) => void;
  workSummary: string;
  setWorkSummary: (value: string) => void;
  nextSteps: string;
  setNextSteps: (value: string) => void;
}) => {
  const ga4 = sourceState(report, "ga4");
  const gsc = sourceState(report, "searchConsole");
  const work = report.report_data?.work;
  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <header className="border-b bg-linear-to-r from-sky-500/[0.12] via-background to-background p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">
              Rapportvoorbeeld · Marketingbende
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{companyName}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {report.title} · {dateLabel(report.current_start)} t/m{" "}
              {dateLabel(report.current_end)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={
                report.status === "final"
                  ? "border-emerald-500/40 text-emerald-600"
                  : "border-amber-500/40 text-amber-600"
              }
            >
              {report.status === "final" ? "Definitief" : "Concept"}
            </Badge>
            <Badge variant="secondary">
              versus {monthLabel(report.previous_start)}
            </Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge
            variant="outline"
            className={ga4.ok ? "text-emerald-600" : "text-amber-600"}
          >
            GA4 · {ga4.label}
          </Badge>
          <Badge
            variant="outline"
            className={gsc.ok ? "text-emerald-600" : "text-amber-600"}
          >
            Search Console · {gsc.label}
          </Badge>
          <Badge variant="outline">
            Data t/m {dateLabel(report.data_through || report.current_end)}
          </Badge>
        </div>
      </header>

      <div className="space-y-7 p-5 md:p-7">
        <section>
          <label className="block">
            <span className="text-lg font-semibold">
              Samenvatting voor de klant
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              De conclusie staat bewust vóór de cijfers. Controleer de
              automatisch opgebouwde tekst voordat u deze deelt.
            </span>
            <Textarea
              className="mt-3 min-h-36 resize-y"
              value={clientSummary}
              onChange={(event) => setClientSummary(event.target.value)}
            />
          </label>
        </section>

        <section>
          <h3 className="text-lg font-semibold">Resultaten maand-op-maand</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            De volledige kalendermaand wordt met de direct voorgaande
            kalendermaand vergeleken. SEO-kerncijfers en bredere websitecontext
            zijn apart gemarkeerd.
          </p>
          {report.headline_metrics.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {report.headline_metrics.map((metric) => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              De gekoppelde bronnen leverden nog geen vergelijkbare totalen. De
              ruwe meetgegevens blijven wel in dit maandarchief bewaard.
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-semibold">
                Werkzaamheden in deze meetmaand
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Gevuld vanuit het blijvende CRM/Trello-werkzaamhedenlogboek.
              </span>
              <Textarea
                className="mt-2 min-h-36 resize-y"
                value={workSummary}
                onChange={(event) => setWorkSummary(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Volgende stappen</span>
              <Textarea
                className="mt-2 min-h-24 resize-y"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
              />
            </label>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border bg-muted/25 p-4">
              <div className="text-sm font-semibold">
                Bewijs van werkzaamheden
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-semibold">
                    {report.current_work_count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    deze meetmaand
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {report.all_time_work_count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    all-time afgerond
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Daarnaast bevat de opdracht {work?.allTimeNoteCount || 0}{" "}
                voortgangsnotities als interne onderbouwing.
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold">
                All-time werkzaamheden
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {(work?.allTime || []).slice(0, 30).map((item) => (
                  <div
                    key={item.id}
                    className="border-l-2 border-sky-500/30 pl-3 text-xs"
                  >
                    <div className="font-medium">{item.task_text}</div>
                    <div className="text-muted-foreground">
                      {new Date(item.completed_at).toLocaleDateString("nl-NL")}
                    </div>
                  </div>
                ))}
                {!work?.allTime?.length ? (
                  <div className="text-xs text-muted-foreground">
                    Vanaf nu worden afgeronde stappen hier blijvend per maand
                    opgebouwd.
                  </div>
                ) : null}
              </div>
            </div>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Interne voortgang uit deze meetmaand ·{" "}
                {work?.currentInternalActivity?.length || 0}
              </summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Alleen als interne bron getoond; deze notities komen niet
                automatisch in de klant-PDF.
              </p>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {(work?.currentInternalActivity || [])
                  .slice(0, 20)
                  .map((activity) => {
                    const date = activityDate(activity);
                    return (
                      <div
                        key={
                          typeof activity.id === "number"
                            ? activity.id
                            : `${date || "notitie"}-${activityText(activity).slice(0, 80)}`
                        }
                        className="rounded-lg bg-muted/35 p-2 text-xs"
                      >
                        <div className="line-clamp-4 whitespace-pre-wrap">
                          {activityText(activity)}
                        </div>
                        {date ? (
                          <div className="mt-1 text-muted-foreground">
                            {new Date(date).toLocaleDateString("nl-NL")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                {!work?.currentInternalActivity?.length ? (
                  <div className="text-xs text-muted-foreground">
                    Geen voortgangsnotities in deze meetmaand.
                  </div>
                ) : null}
              </div>
            </details>
          </aside>
        </div>

        <div className="rounded-xl border border-slate-500/15 bg-slate-500/[0.04] p-3 text-xs leading-5 text-muted-foreground">
          De cijfers tonen een ontwikkeling en kunnen de uitgevoerde
          werkzaamheden ondersteunen. Ze bewijzen op zichzelf geen direct
          oorzakelijk verband met één afzonderlijke SEO-wijziging.
          Kalendermaanden kunnen daarnaast één tot drie meetdagen in lengte
          verschillen.
        </div>
      </div>
    </section>
  );
};

const SeoMonthlyReportEditor = ({
  report,
  companyName,
  controller,
}: {
  report: SeoMonthlyReport;
  companyName: string;
  controller: InzyteWorkspaceController;
}) => {
  const [clientSummary, setClientSummary] = useState(
    report.client_summary || "",
  );
  const [workSummary, setWorkSummary] = useState(report.work_summary || "");
  const [nextSteps, setNextSteps] = useState(report.next_steps || "");
  const clientUpdate = useMemo(
    () => reportText({ report, clientSummary, workSummary, nextSteps }),
    [clientSummary, nextSteps, report, workSummary],
  );

  const openPrintPreview = () => {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.opener = null;
    popup.document.write(
      printDocument({
        report,
        companyName,
        clientSummary,
        workSummary,
        nextSteps,
      }),
    );
    popup.document.close();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="mr-auto">
          <div className="text-sm font-semibold">Rapport gebruiken</div>
          <div className="text-xs text-muted-foreground">
            Controleer eerst het voorbeeld hieronder; de PDF gebruikt exact deze
            inhoud.
          </div>
        </div>
        <Button type="button" variant="outline" onClick={openPrintPreview}>
          <FileDown className="size-4" /> PDF-afdrukvoorbeeld
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(clientUpdate)}
        >
          <Clipboard className="size-4" /> Update kopiëren
        </Button>
        <Button
          type="button"
          disabled={controller.busy !== null}
          onClick={() =>
            void controller
              .finalizeMonthlyReport({
                reportId: report.id,
                clientSummary,
                workSummary,
                nextSteps,
                noteText: clientUpdate,
              })
              .catch(() => undefined)
          }
        >
          {controller.busy === "finalize_monthly_report" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileBarChart className="size-4" />
          )}
          {report.status === "final"
            ? "Wijzigingen opslaan"
            : "Definitief opslaan"}
        </Button>
      </div>
      <ReportPreview
        report={report}
        companyName={companyName}
        clientSummary={clientSummary}
        setClientSummary={setClientSummary}
        workSummary={workSummary}
        setWorkSummary={setWorkSummary}
        nextSteps={nextSteps}
        setNextSteps={setNextSteps}
      />
    </>
  );
};

export const SeoMonthlyReportWorkspace = ({
  record,
  controller,
}: {
  record: Deal;
  controller: InzyteWorkspaceController;
}) => {
  const report = controller.selectedMonthlyReport;
  const companyName =
    controller.bootstrap?.deal.companyName || record.name || "Klant";
  const hasReportSources = Boolean(
    controller.bootstrap?.link?.ga4_property_id ||
      controller.bootstrap?.link?.gsc_site_url,
  );
  const generateReport = () => {
    const replacesFinalReport =
      report?.status === "final" &&
      report.reporting_month.slice(0, 7) === controller.reportingMonth;
    if (
      replacesFinalReport &&
      !window.confirm(
        "Dit definitieve maandrapport opnieuw ophalen en als nieuw concept opslaan? De huidige tekst en meetmomentopname worden vervangen.",
      )
    ) {
      return;
    }
    void controller.generateMonthlyReport().catch(() => undefined);
  };

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-linear-to-br from-sky-500/[0.12] via-card to-card shadow-sm">
        <div className="flex flex-wrap items-center gap-5 p-5 md:p-7">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
            <CalendarRange className="size-7" />
          </div>
          <div className="min-w-64 flex-1">
            <Badge
              variant="outline"
              className="mb-2 border-sky-500/30 text-sky-600"
            >
              Vaste maandelijkse SEO-werkroute
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight">
              Maand-op-maand SEO-update
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Combineert GA4 en Search Console met alle vastgelegde
              werkzaamheden uit deze opdracht. De laatst volledig meetbare
              kalendermaand wordt vergeleken met de maand ervoor.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Meetmaand
              <Input
                type="month"
                max={maxReportingMonth()}
                value={controller.reportingMonth}
                onChange={(event) =>
                  controller.chooseReportingMonth(event.target.value)
                }
                className="mt-1 h-10 w-44 bg-background"
              />
            </label>
            <Button
              type="button"
              size="lg"
              disabled={!hasReportSources || controller.busy !== null}
              onClick={generateReport}
            >
              {controller.busy === "monthly_report" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {report ? "Rapport vernieuwen" : "Rapport maken"}
            </Button>
          </div>
        </div>
        {!hasReportSources ? (
          <div className="border-t border-amber-500/20 bg-amber-500/[0.08] px-6 py-3 text-sm text-amber-700 dark:text-amber-400">
            Koppel minimaal GA4 of Search Console bij de instellingen onderaan
            deze pagina.
          </div>
        ) : null}
      </div>

      {controller.bootstrap?.monthlyReports.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3">
          <History className="size-4 text-muted-foreground" />
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Maandarchief
          </span>
          {controller.bootstrap.monthlyReports.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={report?.id === item.id ? "default" : "outline"}
              onClick={() =>
                controller.chooseReportingMonth(
                  item.reporting_month.slice(0, 7),
                )
              }
            >
              {monthLabel(item.reporting_month)}
              {item.status === "final" ? (
                <CheckCircle2 className="size-3.5" />
              ) : null}
            </Button>
          ))}
        </div>
      ) : null}

      {report ? (
        <SeoMonthlyReportEditor
          key={`${report.id}-${report.updated_at}`}
          report={report}
          companyName={companyName}
          controller={controller}
        />
      ) : (
        <div className="rounded-2xl border border-dashed bg-card/40 p-10 text-center">
          <FileBarChart className="mx-auto size-8 text-sky-500" />
          <h3 className="mt-3 font-semibold">
            Nog geen maandrapport voor deze opdracht
          </h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Kies de meetmaand en maak het eerste rapport. Daarna blijft elke
            maand als heropenbaar concept of definitieve update in de opdracht
            staan.
          </p>
        </div>
      )}
    </section>
  );
};
