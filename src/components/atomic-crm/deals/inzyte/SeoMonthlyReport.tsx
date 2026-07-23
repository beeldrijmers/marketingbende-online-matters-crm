import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clipboard,
  FileBarChart,
  FileDown,
  History,
  Loader2,
  Palette,
  RefreshCw,
  SearchCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  Deal,
  SeoMonthlyHeadlineMetric,
  SeoMonthlyReport,
} from "../../types";
import {
  buildSeoMonthlyReportDocument,
  buildSeoMonthlyReportText,
  changeLabel,
  customerFacingText,
  dateLabel,
  getCustomerReportReadiness,
  getSeoReportBrand,
  metricValue,
  monthLabel,
  ONLINE_MATTERS_LOGO_URL,
  type SeoReportBrand,
} from "./seoMonthlyReportDocument";
import type { InzyteWorkspaceController } from "./useInzyteWorkspaceController";

const maxReportingMonth = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

const ReportEvidencePanel = ({ report }: { report: SeoMonthlyReport }) => {
  const work = report.report_data?.work;
  const evidence = report.report_data?.evidence;
  const evidenceCounts = evidence?.counts;
  return (
    <aside className="space-y-3">
      <div className="rounded-xl border bg-muted/25 p-4">
        <div className="text-sm font-semibold">Bronnen van dit rapport</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          De redactie gebruikt relevante informatie uit het volledige
          opdrachtdossier. Alleen gecontroleerde klanttekst komt in de PDF.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ["Opdrachtomschrijving", evidenceCounts?.assignment || 0],
            ["Afgeronde stappen", evidenceCounts?.completedWork || 0],
            ["Kaartopmerkingen", evidenceCounts?.cardComments || 0],
            ["Verzonden e-mails", evidenceCounts?.sentEmails || 0],
            ["Overige notities", evidenceCounts?.otherNotes || 0],
          ].map(([label, count]) => (
            <div key={String(label)} className="rounded-lg border p-2">
              <div className="text-lg font-semibold">{count}</div>
              <div className="text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs leading-5 text-muted-foreground">
          {evidence?.gmailStatus === "connected"
            ? "Relevante verzonden e-mails zijn meegenomen."
            : evidence?.gmailStatus === "not_connected"
              ? "De mailbox is niet gekoppeld; het rapport gebruikt de overige opdrachtbronnen."
              : evidence?.gmailStatus === "failed"
                ? "Verzonden e-mails konden tijdelijk niet worden gecontroleerd; vernieuw het rapport om opnieuw te proberen."
                : "Er zijn voor deze opdracht geen relevante verzonden SEO-updates gevonden."}
        </div>
      </div>
      <details open className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Gebruikte informatie uit deze meetmaand ·{" "}
          {evidence?.current?.length || 0}
        </summary>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {(evidence?.current || []).slice(0, 30).map((item) => (
            <div key={item.id} className="rounded-lg bg-muted/35 p-2 text-xs">
              <div className="font-medium">{item.title}</div>
              <div className="mt-1 line-clamp-5 whitespace-pre-wrap text-muted-foreground">
                {item.excerpt}
              </div>
              {item.date ? (
                <div className="mt-1 text-muted-foreground">
                  {new Date(item.date).toLocaleDateString("nl-NL")}
                </div>
              ) : null}
            </div>
          ))}
          {!evidence?.current?.length ? (
            <div className="text-xs text-muted-foreground">
              Voor deze meetmaand is nog geen aanvullende voortgang vastgelegd.
            </div>
          ) : null}
        </div>
      </details>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Historisch dossier · {evidence?.allTime?.length || 0} bronnen
        </summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Oudere informatie geeft context en helpt voorkomen dat eerder werk
          wordt vergeten, maar wordt niet als nieuw werk gepresenteerd.
        </p>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {(evidence?.allTime || []).slice(0, 30).map((item) => (
            <div
              key={item.id}
              className="border-l-2 border-sky-500/30 pl-3 text-xs"
            >
              <div className="font-medium">{item.title}</div>
              <div className="line-clamp-3 text-muted-foreground">
                {item.excerpt}
              </div>
            </div>
          ))}
          {!evidence?.allTime?.length ? (
            <div className="text-xs text-muted-foreground">
              Het historische dossier wordt vanaf het volgende rapport verder
              opgebouwd.
            </div>
          ) : null}
        </div>
      </details>
      <div className="rounded-xl border p-4">
        <div className="text-sm font-semibold">Werkzaamhedenregistratie</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-semibold">
              {report.current_work_count}
            </div>
            <div className="text-xs text-muted-foreground">deze meetmaand</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {report.all_time_work_count}
            </div>
            <div className="text-xs text-muted-foreground">
              sinds de start afgerond
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Het dossier bevat daarnaast {work?.allTimeNoteCount || 0}{" "}
          voortgangsnotities.
        </div>
      </div>
    </aside>
  );
};

const ReportPreview = ({
  report,
  companyName,
  brand,
  clientSummary,
  setClientSummary,
  interpretation,
  setInterpretation,
  workSummary,
  setWorkSummary,
  caveats,
  setCaveats,
  nextSteps,
  setNextSteps,
}: {
  report: SeoMonthlyReport;
  companyName: string;
  brand: SeoReportBrand;
  clientSummary: string;
  setClientSummary: (value: string) => void;
  interpretation: string;
  setInterpretation: (value: string) => void;
  workSummary: string;
  setWorkSummary: (value: string) => void;
  caveats: string;
  setCaveats: (value: string) => void;
  nextSteps: string;
  setNextSteps: (value: string) => void;
}) => {
  const ga4 = sourceState(report, "ga4");
  const gsc = sourceState(report, "searchConsole");
  const isOnlineMatters = brand === "online_matters";
  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <header
        className={cn(
          "border-b p-5 md:p-7",
          isOnlineMatters
            ? "bg-linear-to-r from-lime-500/[0.16] via-background to-background"
            : "bg-linear-to-r from-blue-500/[0.12] via-background to-background",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {isOnlineMatters ? (
              <img
                src={ONLINE_MATTERS_LOGO_URL}
                alt="Online Matters"
                className="mb-4 h-auto w-52 max-w-full rounded-sm bg-white p-1"
              />
            ) : null}
            <div
              className={cn(
                "text-xs font-bold uppercase tracking-[0.16em]",
                isOnlineMatters ? "text-lime-700" : "text-blue-600",
              )}
            >
              Klantvoorbeeld · SEO-maandrapport
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

        <label className="block rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
          <span className="text-sm font-semibold">
            Wat deze ontwikkeling betekent
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            De praktische duiding van de cijfers, zonder een onbewezen direct
            verband met één wijziging te claimen.
          </span>
          <Textarea
            className="mt-2 min-h-28 resize-y bg-background"
            value={interpretation}
            onChange={(event) => setInterpretation(event.target.value)}
          />
        </label>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-semibold">
                Werkzaamheden in deze meetmaand
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Gebaseerd op de werkzaamheden die voor deze opdracht zijn
                afgerond. Alleen deze tekst komt in de klantversie.
              </span>
              <Textarea
                className="mt-2 min-h-36 resize-y"
                value={workSummary}
                onChange={(event) => setWorkSummary(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">
                Eerlijke aandachtspunten
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Benoem wat nog niet overtuigend groeit, welke afhankelijkheden
                er zijn en waar voorzichtigheid in de interpretatie nodig is.
              </span>
              <Textarea
                className="mt-2 min-h-28 resize-y"
                value={caveats}
                onChange={(event) => setCaveats(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Vooruitblik</span>
              <Textarea
                className="mt-2 min-h-24 resize-y"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
              />
            </label>
          </div>

          <ReportEvidencePanel report={report} />
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
  const [clientSummary, setClientSummary] = useState(() =>
    customerFacingText(report.client_summary || ""),
  );
  const [interpretation, setInterpretation] = useState(() =>
    customerFacingText(report.report_data?.narrative?.interpretation || ""),
  );
  const [workSummary, setWorkSummary] = useState(() =>
    customerFacingText(report.work_summary || ""),
  );
  const [caveats, setCaveats] = useState(() =>
    customerFacingText(report.report_data?.narrative?.caveats || ""),
  );
  const [nextSteps, setNextSteps] = useState(() =>
    customerFacingText(report.next_steps || ""),
  );
  const [brand, setBrand] = useState<SeoReportBrand>(() =>
    getSeoReportBrand(report),
  );
  const readiness = useMemo(
    () =>
      getCustomerReportReadiness({
        report,
        clientSummary,
        interpretation,
        workSummary,
        caveats,
        nextSteps,
      }),
    [caveats, clientSummary, interpretation, nextSteps, report, workSummary],
  );
  const clientUpdate = useMemo(
    () =>
      buildSeoMonthlyReportText({
        report,
        clientSummary,
        interpretation,
        workSummary,
        caveats,
        nextSteps,
      }),
    [caveats, clientSummary, interpretation, nextSteps, report, workSummary],
  );

  const openPrintPreview = () => {
    if (!readiness.ready) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.opener = null;
    popup.document.write(
      buildSeoMonthlyReportDocument({
        report,
        companyName,
        clientSummary,
        interpretation,
        workSummary,
        caveats,
        nextSteps,
        brand,
      }),
    );
    popup.document.close();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="mr-auto">
          <div className="text-sm font-semibold">Rapport gebruiken</div>
          <div className="text-xs text-muted-foreground">
            Controleer eerst het voorbeeld hieronder; de PDF gebruikt exact deze
            inhoud.
          </div>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium">
          <Palette className="size-4 text-lime-600" />
          Online Matters-stijl
          <Switch
            checked={brand === "online_matters"}
            onCheckedChange={(checked) =>
              setBrand(checked ? "online_matters" : "neutral")
            }
            aria-label="Online Matters-huisstijl gebruiken"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={!readiness.ready}
          onClick={openPrintPreview}
        >
          <FileDown className="size-4" /> PDF-afdrukvoorbeeld
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!readiness.ready}
          onClick={() => void navigator.clipboard.writeText(clientUpdate)}
        >
          <Clipboard className="size-4" /> Update kopiëren
        </Button>
        <Button
          type="button"
          disabled={!readiness.ready || controller.busy !== null}
          onClick={() =>
            void controller
              .finalizeMonthlyReport({
                reportId: report.id,
                clientSummary,
                interpretation,
                workSummary,
                caveats,
                nextSteps,
                noteText: clientUpdate,
                reportBrand: brand,
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
      {!readiness.ready ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">Rapport nog niet deelbaar</div>
            <div className="mt-0.5 text-xs leading-5">
              Nog nodig: {readiness.reasons.join(", ")}. De PDF, kopieerknop en
              definitieve opslag blijven uit totdat de klantversie compleet is.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Klantversie is compleet en gereed
          voor controle.
        </div>
      )}
      <ReportPreview
        report={report}
        companyName={companyName}
        brand={brand}
        clientSummary={clientSummary}
        setClientSummary={setClientSummary}
        interpretation={interpretation}
        setInterpretation={setInterpretation}
        workSummary={workSummary}
        setWorkSummary={setWorkSummary}
        caveats={caveats}
        setCaveats={setCaveats}
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
              Combineert GA4 en Search Console met de opdrachtomschrijving,
              afgeronde werkzaamheden, kaartopmerkingen, voortgangsnotities en
              relevante verzonden e-mails. De laatst volledig meetbare
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
