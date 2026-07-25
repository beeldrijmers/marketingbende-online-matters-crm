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
  hasCompleteMeasurementPair,
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
  source: "ga4" | "searchConsole" | "businessProfile" | "googleAds",
): { ok: boolean; label: string } => {
  const sources = report.report_data?.sources as
    | Record<
        string,
        { current?: { status?: string }; previous?: { status?: string } }
      >
    | undefined;
  const current = sources?.[source]?.current?.status;
  const previous = sources?.[source]?.previous?.status;
  if (current === "success" && previous === "success") {
    const metricSource = {
      ga4: "GA4",
      searchConsole: "Search Console",
      businessProfile: "Google Bedrijfsprofiel",
      googleAds: "Google Ads",
    }[source];
    const hasUsableMetrics = report.headline_metrics.some(
      (metric) => metric.source === metricSource,
    );
    return hasUsableMetrics
      ? { ok: true, label: "Beide maanden gemeten" }
      : { ok: false, label: "Geen bruikbare kerncijfers" };
  }
  if (
    (!current && !previous) ||
    (current === "unavailable" && previous === "unavailable")
  ) {
    return { ok: false, label: "Niet gekoppeld" };
  }
  if (current === "failed" || previous === "failed") {
    return { ok: false, label: "Tijdelijk niet beschikbaar" };
  }
  return { ok: false, label: "Onvolledig" };
};

const metricGroupLabel = (group: SeoMonthlyHeadlineMetric["group"]): string =>
  ({
    seo: "SEO-kerncijfer",
    website_context: "Websitecontext",
    ads: "Advertenties",
    local: "Lokale zichtbaarheid",
  })[group];

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
          {metricGroupLabel(metric.group)}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {metric.definition} Bron: {metric.source}.
      </p>
    </article>
  );
};

type ReportEvidenceItem = NonNullable<
  NonNullable<SeoMonthlyReport["report_data"]["evidence"]>["current"]
>[number];

const countReportEvidenceItems = (items: ReportEvidenceItem[] = []) => ({
  assignment: items.filter((item) => item.kind === "assignment").length,
  completedWork: items.filter((item) => item.kind === "completed_work").length,
  cardComments: items.filter((item) => item.kind === "card_comment").length,
  sentEmails: items.filter((item) => item.kind === "sent_email").length,
  otherNotes: items.filter((item) => item.kind === "note").length,
});

const ReportEvidencePanel = ({ report }: { report: SeoMonthlyReport }) => {
  const work = report.report_data?.work;
  const evidence = report.report_data?.evidence;
  const currentCounts =
    evidence?.currentCounts ||
    countReportEvidenceItems(evidence?.current || []);
  const allTimeCounts =
    evidence?.allTimeCounts ||
    evidence?.counts ||
    countReportEvidenceItems(evidence?.allTime || []);
  const allTimeTotal = Object.values(allTimeCounts).reduce(
    (total, count) => total + (count || 0),
    0,
  );
  return (
    <aside className="space-y-3">
      <div className="rounded-xl border bg-muted/25 p-4">
        <div className="text-sm font-semibold">
          Bronnen uit deze rapportagemaand
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Deze aantallen gaan uitsluitend over de gekozen maand. Historische
          informatie blijft apart als context beschikbaar.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ["Afgeronde stappen", currentCounts.completedWork || 0],
            ["Kaartopmerkingen", currentCounts.cardComments || 0],
            ["Verzonden e-mails", currentCounts.sentEmails || 0],
            ["Overige notities", currentCounts.otherNotes || 0],
          ].map(([label, count]) => (
            <div key={String(label)} className="rounded-lg border p-2">
              <div className="text-lg font-semibold">{count}</div>
              <div className="text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          De opdrachtomschrijving is als vaste context{" "}
          {allTimeCounts.assignment ? "meegenomen" : "niet beschikbaar"}. Het
          volledige dossier bevat {allTimeTotal} bruikbare bronitems.
        </div>
        <div className="mt-3 text-xs leading-5 text-muted-foreground">
          {evidence?.gmailStatus === "connected"
            ? "Relevante verzonden e-mails zijn meegenomen."
            : evidence?.gmailStatus === "not_connected"
              ? "De mailbox is niet gekoppeld; het rapport gebruikt de overige opdrachtbronnen."
              : evidence?.gmailStatus === "failed"
                ? "Verzonden e-mails konden tijdelijk niet worden gecontroleerd; vernieuw het rapport om opnieuw te proberen."
                : "Er zijn voor deze opdracht geen relevante verzonden voortgangsupdates gevonden."}
        </div>
      </div>
      <details open className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Gebruikte informatie uit deze rapportagemaand ·{" "}
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
              Voor deze rapportagemaand is nog geen aanvullende voortgang
              vastgelegd.
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
            <div className="text-xs text-muted-foreground">
              deze rapportagemaand
            </div>
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
  const gbp = sourceState(report, "businessProfile");
  const ads = sourceState(report, "googleAds");
  const hasMeasurement =
    hasCompleteMeasurementPair(report) && report.headline_metrics.length > 0;
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
              Klantvoorbeeld · maandrapportage
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
            {hasMeasurement ? (
              <Badge variant="secondary">
                versus {monthLabel(report.previous_start)}
              </Badge>
            ) : null}
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
          <Badge
            variant="outline"
            className={ads.ok ? "text-emerald-600" : "text-amber-600"}
          >
            Google Ads · {ads.label}
          </Badge>
          <Badge
            variant="outline"
            className={gbp.ok ? "text-emerald-600" : "text-amber-600"}
          >
            Bedrijfsprofiel · {gbp.label}
          </Badge>
          <Badge variant="outline">
            {hasMeasurement && report.data_through
              ? `Meetdata t/m ${dateLabel(report.data_through)}`
              : "Werkzaamhedenrapport zonder meetcijfers"}
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
          <h3 className="text-lg font-semibold">
            {hasMeasurement
              ? "Meetresultaten maand-op-maand"
              : "Voortgang zonder meetkoppeling"}
          </h3>
          {hasMeasurement ? (
            <p className="mt-1 text-sm text-muted-foreground">
              De volledige kalendermaand wordt met de direct voorgaande
              kalendermaand vergeleken. De bron en het soort meetpunt staan per
              cijfer vermeld.
            </p>
          ) : null}
          {hasMeasurement ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {report.headline_metrics.map((metric) => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-5 text-sm leading-6 text-muted-foreground">
              Dit rapport is opgebouwd uit de vastgelegde werkzaamheden,
              opdrachtinformatie, kaartnotities en relevante correspondentie. Er
              is geen volledige gecontroleerde meetreeks gebruikt. Daarom worden
              geen verkeers-, advertentie-, conversie- of rankingresultaten
              geclaimd.
            </div>
          )}
        </section>

        <label className="block rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
          <span className="text-sm font-semibold">
            {hasMeasurement
              ? "Wat deze ontwikkeling betekent"
              : "Wat deze voortgang betekent"}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {hasMeasurement
              ? "De praktische duiding van de cijfers, zonder een onbewezen direct verband met één wijziging te claimen."
              : "De praktische duiding van het uitgevoerde werk, zonder meetresultaten te suggereren die niet beschikbaar zijn."}
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
                Werkzaamheden in deze rapportagemaand
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
          {hasMeasurement
            ? "De cijfers tonen een ontwikkeling en kunnen de uitgevoerde werkzaamheden ondersteunen. Ze bewijzen op zichzelf geen direct oorzakelijk verband met één afzonderlijke wijziging. Kalendermaanden kunnen daarnaast één tot drie meetdagen in lengte verschillen."
            : "Deze versie verantwoordt wat aantoonbaar is uitgevoerd en vastgelegd. Zonder volledige gecontroleerde meetreeks doet het rapport bewust geen uitspraak over het effect op verkeer, vindbaarheid, advertenties of conversies."}
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
  const [reviewConfirmed, setReviewConfirmed] = useState(
    () => report.report_data?.narrative?.reviewed === true,
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

    const reportHtml = buildSeoMonthlyReportDocument({
      report,
      companyName,
      clientSummary,
      interpretation,
      workSummary,
      caveats,
      nextSteps,
      brand,
    });
    const reportUrl = URL.createObjectURL(
      new Blob([reportHtml], { type: "text/html;charset=utf-8" }),
    );

    window.open(reportUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(reportUrl), 60_000);
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
        <label className="flex h-9 items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-3 text-xs font-medium">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Tekst en bronnen gecontroleerd
          <Switch
            checked={reviewConfirmed}
            onCheckedChange={setReviewConfirmed}
            aria-label="Bevestigen dat tekst en bronnen zijn gecontroleerd"
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
          disabled={!readiness.ready || !reviewConfirmed}
          onClick={() => void navigator.clipboard.writeText(clientUpdate)}
        >
          <Clipboard className="size-4" /> Update kopiëren
        </Button>
        <Button
          type="button"
          disabled={
            !readiness.ready || !reviewConfirmed || controller.busy !== null
          }
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
      ) : !reviewConfirmed ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">
              Inhoud compleet, broncontrole nodig
            </div>
            <div className="mt-0.5 text-xs leading-5">
              Controleer de werkzaamheden, meetcijfers en klanttekst in het
              voorbeeld. Bevestig daarna bovenaan dat tekst en bronnen zijn
              gecontroleerd.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Klantversie en brongegevens zijn
          gecontroleerd en gereed om te delen.
        </div>
      )}
      <ReportPreview
        report={report}
        companyName={companyName}
        brand={brand}
        clientSummary={clientSummary}
        setClientSummary={(value) => {
          setClientSummary(value);
          setReviewConfirmed(false);
        }}
        interpretation={interpretation}
        setInterpretation={(value) => {
          setInterpretation(value);
          setReviewConfirmed(false);
        }}
        workSummary={workSummary}
        setWorkSummary={(value) => {
          setWorkSummary(value);
          setReviewConfirmed(false);
        }}
        caveats={caveats}
        setCaveats={(value) => {
          setCaveats(value);
          setReviewConfirmed(false);
        }}
        nextSteps={nextSteps}
        setNextSteps={(value) => {
          setNextSteps(value);
          setReviewConfirmed(false);
        }}
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
  const hasVerifiedMeasurement =
    controller.hasGa4 ||
    controller.hasGsc ||
    controller.hasGbp ||
    controller.hasAds;
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
              Vaste maandelijkse rapportageroute
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight">
              Maandrapportage
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Maakt altijd een klantupdate van de opdrachtomschrijving,
              afgeronde werkzaamheden, kaartopmerkingen, voortgangsnotities en
              relevante verzonden e-mails. Gecontroleerde GA4-, Search Console-,
              Ads- en Bedrijfsprofielgegevens worden automatisch als
              maandvergelijking toegevoegd wanneer ze beschikbaar zijn.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Rapportagemaand
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
              disabled={controller.busy !== null}
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
        {!hasVerifiedMeasurement ? (
          <div className="border-t border-sky-500/20 bg-sky-500/[0.07] px-6 py-3 text-sm text-sky-700 dark:text-sky-400">
            Geen meetbron nodig: de rapportage wordt nu opgebouwd uit
            werkzaamheden, notities en correspondentie. Koppel alleen een
            meetbron wanneer u ook maand-op-maandcijfers wilt opnemen.
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
            Kies de rapportagemaand en maak het eerste rapport. Daarna blijft
            elke maand als heropenbaar concept of definitieve update in de
            opdracht staan.
          </p>
        </div>
      )}
    </section>
  );
};
