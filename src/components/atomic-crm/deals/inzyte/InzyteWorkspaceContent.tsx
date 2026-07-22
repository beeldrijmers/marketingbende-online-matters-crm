import { type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Braces,
  Clipboard,
  Database,
  Download,
  FileBarChart,
  Gauge,
  Globe2,
  History,
  Link2,
  ListChecks,
  Loader2,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  Printer,
  Radio,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Deal, InzyteRun } from "../../types";
import { InzyteConnections } from "./InzyteConnections";
import { InzyteDataView } from "./InzyteDataView";
import { unwrapInzyteData } from "./inzyteData";
import {
  buildClientUpdateText,
  buildInzytePresentation,
  buildInzytePrintDocument,
  humanizeInzyteField,
} from "./inzytePresentation";
import type {
  ActionResult,
  InzyteWorkspaceController,
  SectionType,
} from "./useInzyteWorkspaceController";

const SECTION_ITEMS: Array<[SectionType, string]> = [
  ["traffic_comprehensive", "Verkeer"],
  ["user_behavior_comprehensive", "Gedrag"],
  ["ecommerce_comprehensive", "E-commerce"],
  ["geographic_comprehensive", "Geografie"],
  ["demographics_comprehensive", "Demografie"],
  ["content_comprehensive", "Content"],
  ["realtime_comprehensive", "Realtime"],
  ["trends_comprehensive", "Trends"],
];

const ACTION_LABELS: Record<string, string> = {
  overview: "Klantoverzicht",
  report: "Klantrapportage",
  trend: "Dagelijkse ontwikkeling",
  realtime: "Live verkeer",
  traffic: "Verkeersanalyse",
  pages: "Pagina-analyse",
  conversions: "Conversies",
  events: "Gebeurtenissen",
  campaigns: "Campagneresultaten",
  highlights: "Belangrijkste ontwikkelingen",
  source_products: "Gegevensbronnen",
  detailed: "Verdiepende analyse",
  custom_dimensions: "Aangepaste dimensies",
  annotations: "Annotaties",
  search_console: "SEO en Search Console",
  business_profile: "Google Bedrijfsprofiel",
  google_ads: "Google Ads",
  ai_insights: "AI-inzichten",
  audience: "Doelgroepanalyse",
  audience_intelligence: "Persona’s en contentstrategie",
  kpi_insights: "KPI-inzichten",
  practical_recommendations: "Praktische aanbevelingen",
  comprehensive_analysis: "Uitgebreide analyse",
  deep_analysis: "Strategische diepte-analyse",
  section_analysis: "Onderwerpanalyse",
  conversion_analysis: "Conversieadvies",
  executive_summary: "Klantupdate",
  strategic_recommendations: "Strategische aanbevelingen",
  vraagbaak: "Antwoord uit de klantdata",
  history: "Historisch resultaat",
};

const safeFilename = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "inzyte-resultaat";

const downloadBlob = (contents: string, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const csvCell = (value: unknown): string =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const resultToCsv = (data: unknown): string | null => {
  const table = buildInzytePresentation(data).tables[0];
  if (!table) return null;
  return [
    table.columns
      .map((column) => csvCell(humanizeInzyteField(column)))
      .join(";"),
    ...table.rows
      .slice(0, 5_000)
      .map((row) =>
        table.columns.map((column) => csvCell(row[column])).join(";"),
      ),
  ].join("\n");
};

const ResultToolbar = ({
  result,
  dealName,
  action,
  controller,
}: {
  result: ActionResult;
  dealName: string;
  action: string;
  controller: InzyteWorkspaceController;
}) => {
  const actionLabel = ACTION_LABELS[action] || humanizeInzyteField(action);
  const filename = `${safeFilename(dealName)}-${safeFilename(actionLabel)}`;
  const clientText = buildClientUpdateText({
    data: result.data,
    title: dealName,
    actionLabel,
    completedAt: result.completedAt,
    startDate: result.startDate || controller.startDate,
    endDate: result.endDate || controller.endDate,
  });
  const printReport = () => {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.opener = null;
    popup.document.write(
      buildInzytePrintDocument({
        data: result.data,
        title: dealName,
        actionLabel,
        completedAt: result.completedAt,
        startDate: result.startDate || controller.startDate,
        endDate: result.endDate || controller.endDate,
      }),
    );
    popup.document.close();
  };

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-52">
          <div className="text-sm font-semibold">Resultaat gebruiken</div>
          <div className="text-xs text-muted-foreground">
            Deel een nette PDF of leg de update vast bij de opdracht.
          </div>
        </div>
        <Button type="button" size="sm" onClick={printReport}>
          <Printer className="size-4" /> PDF-rapport maken
        </Button>
        {result.runId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={controller.busy === "save_note"}
            onClick={() => controller.saveNote(result.runId!, clientText)}
          >
            {controller.busy === "save_note" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareText className="size-4" />
            )}
            Opslaan als klantupdate
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigator.clipboard.writeText(clientText)}
        >
          <Clipboard className="size-4" /> Tekst kopiëren
        </Button>
      </div>
      <details className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none py-1 font-medium">
          Gegevens exporteren
        </summary>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadBlob(
                JSON.stringify(unwrapInzyteData(result.data), null, 2),
                "application/json;charset=utf-8",
                `${filename}.json`,
              )
            }
          >
            <Download className="size-4" /> Brondata als JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const csv = resultToCsv(result.data);
              if (csv) {
                downloadBlob(
                  `\ufeff${csv}`,
                  "text/csv;charset=utf-8",
                  `${filename}.csv`,
                );
              }
            }}
          >
            <Download className="size-4" /> Tabel als CSV
          </Button>
        </div>
      </details>
    </div>
  );
};

const AnalysisCard = ({
  title,
  description,
  icon,
  selected,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    className={cn(
      "group flex min-h-28 items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-sky-500/40 hover:bg-sky-500/[0.04] disabled:cursor-not-allowed disabled:opacity-45",
      selected && "border-sky-500/50 bg-sky-500/[0.07] ring-1 ring-sky-500/20",
    )}
    onClick={onClick}
  >
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-sky-500/10 group-hover:text-sky-500">
      {loading ? <Loader2 className="size-5 animate-spin" /> : icon}
    </span>
    <span className="min-w-0">
      <span className="block font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </span>
  </button>
);

const ActionButton = ({
  action,
  controller,
  disabled,
  icon,
  onClick,
}: {
  action: string;
  controller: InzyteWorkspaceController;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={disabled || controller.busy !== null}
    onClick={onClick}
  >
    {controller.busy === action ? (
      <Loader2 className="size-4 animate-spin" />
    ) : (
      icon || <Activity className="size-4" />
    )}
    {ACTION_LABELS[action] || humanizeInzyteField(action)}
  </Button>
);

const DateBar = ({ controller }: { controller: InzyteWorkspaceController }) => {
  const { bootstrap } = controller;
  if (!bootstrap) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <span className="text-xs font-medium text-muted-foreground">
        Analyseperiode
      </span>
      <Input
        aria-label="Begindatum"
        type="date"
        value={controller.startDate}
        max={controller.endDate}
        onChange={(event) => controller.setStartDate(event.target.value)}
        className="h-8 w-40"
      />
      <span className="text-xs text-muted-foreground">t/m</span>
      <Input
        aria-label="Einddatum"
        type="date"
        value={controller.endDate}
        min={controller.startDate}
        onChange={(event) => controller.setEndDate(event.target.value)}
        className="h-8 w-40"
      />
      <div className="ml-auto flex flex-wrap gap-2">
        <Badge variant="outline">
          {bootstrap.deal.companyName || "Geen bedrijfsnaam"}
        </Badge>
        <Badge
          variant={controller.hasGa4 ? "secondary" : "outline"}
          className={
            controller.hasGa4 ? "" : "border-amber-500/40 text-amber-600"
          }
        >
          {controller.hasGa4
            ? `GA4 · ${
                bootstrap.link?.ga4_property_name ||
                bootstrap.link?.ga4_property_id
              }`
            : "GA4 nog niet ingesteld"}
        </Badge>
      </div>
    </div>
  );
};

const PrimaryOutput = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => (
  <section className="overflow-hidden rounded-2xl border border-sky-500/25 bg-linear-to-br from-sky-500/[0.12] via-card to-card shadow-sm">
    <div className="flex flex-wrap items-center gap-5 p-6 md:p-7">
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
        <FileBarChart className="size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <Badge
          variant="outline"
          className="mb-2 border-sky-500/30 text-sky-600"
        >
          Belangrijkste werkroute
        </Badge>
        <h2 className="text-2xl font-semibold tracking-tight">
          Klantupdate en PDF-rapport
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Vertaal actuele klantdata naar een begrijpelijke update voor de klant,
          of bouw een verzorgd rapport met kerncijfers en onderbouwing.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          disabled={!controller.hasGa4 || controller.busy !== null}
          onClick={() => controller.runContextualAi("executive_summary")}
        >
          {controller.busy === "executive_summary" ||
          controller.busy === "overview" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageSquareText className="size-4" />
          )}
          Klantupdate maken
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={!controller.hasGa4 || controller.busy !== null}
          onClick={() =>
            void controller.runAction("report").catch(() => undefined)
          }
        >
          {controller.busy === "report" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          PDF-rapport voorbereiden
        </Button>
      </div>
    </div>
    {!controller.hasGa4 ? (
      <div className="border-t border-amber-500/20 bg-amber-500/[0.08] px-6 py-3 text-sm text-amber-700 dark:text-amber-400">
        Stel eerst de GA4-koppeling in bij “Koppelingen en instellingen”
        onderaan deze pagina.
      </div>
    ) : null}
  </section>
);

const AnalysisGrid = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => {
  const analyses = [
    [
      "overview",
      "Klantoverzicht",
      "Kerncijfers, ontwikkeling, kanalen en toppagina’s.",
      Gauge,
    ],
    [
      "traffic",
      "Verkeer",
      "Herkomst, apparaten, landen en bezoekersgedrag.",
      BarChart3,
    ],
    [
      "pages",
      "Pagina’s",
      "Best presterende pagina’s, landingen en kansen.",
      Globe2,
    ],
    [
      "conversions",
      "Conversies",
      "Doelen, gebeurtenissen en resultaat per sessie.",
      Target,
    ],
    [
      "search_console",
      "SEO en Search Console",
      "Klikken, vertoningen, zoektermen en posities.",
      Search,
    ],
    [
      "campaigns",
      "Campagnes",
      "UTM-verkeer, campagneprestaties en rendement.",
      Megaphone,
    ],
  ] as const;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Kies een verdiepende analyse</h2>
        <p className="text-sm text-muted-foreground">
          Het laatst gekozen resultaat verschijnt direct onder deze knoppen.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {analyses.map(([action, title, description, Icon]) => (
          <AnalysisCard
            key={action}
            title={title}
            description={description}
            icon={<Icon className="size-5" />}
            selected={controller.selectedAction === action}
            loading={controller.busy === action}
            disabled={
              controller.busy !== null ||
              !controller.hasGa4 ||
              (action === "search_console" &&
                !controller.bootstrap?.link?.gsc_site_url)
            }
            onClick={() =>
              void controller
                .runAction(
                  action,
                  action === "search_console" ? { forceRefresh: true } : {},
                )
                .catch(() => undefined)
            }
          />
        ))}
        <AnalysisCard
          title="Doelgroep"
          description="Segmenten, persona’s, kanalen en contentaanpak."
          icon={<Users className="size-5" />}
          selected={controller.selectedAction === "audience"}
          loading={controller.busy === "audience"}
          disabled={!controller.hasGa4 || controller.busy !== null}
          onClick={() => controller.runAudience("audience")}
        />
        <AnalysisCard
          title="AI-advies"
          description="Kansen, waarschuwingen en concrete vervolgstappen."
          icon={<Sparkles className="size-5" />}
          selected={controller.selectedAction === "ai_insights"}
          loading={controller.busy === "ai_insights"}
          disabled={!controller.hasGa4 || controller.busy !== null}
          onClick={controller.runAiInsights}
        />
      </div>
    </section>
  );
};

const ResultSection = ({
  record,
  controller,
}: {
  record: Deal;
  controller: InzyteWorkspaceController;
}) => (
  <section className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm md:p-5">
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">
          {controller.selectedResult
            ? ACTION_LABELS[controller.selectedAction] ||
              humanizeInzyteField(controller.selectedAction)
            : "Resultaat"}
        </h2>
        {controller.selectedResult ? (
          <Badge variant="secondary">Actuele gegevens</Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {controller.selectedResult
          ? `Opgehaald op ${new Date(
              controller.selectedResult.completedAt,
            ).toLocaleString("nl-NL")}`
          : "Kies hierboven een klantupdate, rapport of analyse."}
      </p>
    </div>
    {controller.selectedResult ? (
      <>
        <ResultToolbar
          result={controller.selectedResult}
          dealName={record.name}
          action={controller.selectedAction}
          controller={controller}
        />
        <InzyteDataView data={controller.selectedResult.data} />
      </>
    ) : (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        De resultaten worden hier klantvriendelijk in het Nederlands
        gepresenteerd. Technische bronvelden blijven apart inklapbaar.
      </div>
    )}
  </section>
);

const QuestionContent = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => (
  <div className="space-y-3">
    <Textarea
      value={controller.question}
      maxLength={2_000}
      rows={4}
      placeholder="Vraag bijvoorbeeld: waarom daalde organisch verkeer en wat moeten we deze maand doen?"
      onChange={(event) => controller.setQuestion(event.target.value)}
    />
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        {controller.question.length}/2.000 tekens
      </span>
      <Button
        type="button"
        disabled={
          !controller.hasGa4 ||
          controller.busy !== null ||
          controller.question.trim().length === 0
        }
        onClick={() =>
          void controller
            .runAction("vraagbaak", { question: controller.question })
            .catch(() => undefined)
        }
      >
        {controller.busy === "vraagbaak" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bot className="size-4" />
        )}
        Vraag stellen
      </Button>
    </div>
  </div>
);

const MoreAnalysisContent = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => (
  <div className="space-y-5">
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Aanvullende rapportages
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          action="realtime"
          controller={controller}
          disabled={!controller.hasGa4}
          icon={<Radio className="size-4" />}
          onClick={() =>
            void controller.runAction("realtime").catch(() => undefined)
          }
        />
        {(["trend", "events"] as const).map((action) => (
          <ActionButton
            key={action}
            action={action}
            controller={controller}
            disabled={!controller.hasGa4}
            onClick={() =>
              void controller.runAction(action).catch(() => undefined)
            }
          />
        ))}
        <ActionButton
          action="conversion_analysis"
          controller={controller}
          disabled={!controller.hasGa4}
          onClick={controller.runConversionAdvice}
        />
        <ActionButton
          action="business_profile"
          controller={controller}
          disabled={!controller.bootstrap?.link?.gbp_location_id}
          onClick={() =>
            void controller
              .runAction("business_profile", { forceRefresh: true })
              .catch(() => undefined)
          }
        />
        <ActionButton
          action="google_ads"
          controller={controller}
          disabled={!controller.bootstrap?.link?.ads_customer_id}
          icon={<MousePointerClick className="size-4" />}
          onClick={() =>
            void controller
              .runAction("google_ads", { forceRefresh: true })
              .catch(() => undefined)
          }
        />
        <ActionButton
          action="audience_intelligence"
          controller={controller}
          disabled={!controller.hasGa4}
          icon={<Users className="size-4" />}
          onClick={() => controller.runAudience("audience_intelligence")}
        />
      </div>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Advies en verdieping
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          action="highlights"
          controller={controller}
          disabled={!controller.hasGa4}
          onClick={() =>
            void controller.runAction("highlights").catch(() => undefined)
          }
        />
        <ActionButton
          action="strategic_recommendations"
          controller={controller}
          disabled={!controller.hasGa4}
          onClick={() =>
            controller.runContextualAi("strategic_recommendations")
          }
        />
        {(
          [
            "kpi_insights",
            "practical_recommendations",
            "comprehensive_analysis",
            "deep_analysis",
          ] as const
        ).map((action) => (
          <ActionButton
            key={action}
            action={action}
            controller={controller}
            disabled={!controller.hasGa4}
            icon={<Sparkles className="size-4" />}
            onClick={() => controller.runStructuredAi(action)}
          />
        ))}
      </div>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Verdieping per onderwerp
      </div>
      <div className="flex flex-wrap gap-2">
        {SECTION_ITEMS.map(([sectionType, label]) => (
          <Button
            key={sectionType}
            type="button"
            variant="outline"
            size="sm"
            disabled={!controller.hasGa4 || controller.busy !== null}
            onClick={() => controller.runSectionAnalysis(sectionType)}
          >
            <Sparkles className="size-4" /> {label}
          </Button>
        ))}
      </div>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Technische hulpmiddelen
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          "custom_dimensions",
          "annotations",
          "source_products",
          "detailed",
        ].map((action) => (
          <ActionButton
            key={action}
            action={action}
            controller={controller}
            disabled={!controller.hasGa4}
            icon={
              action === "source_products" ? (
                <ListChecks className="size-4" />
              ) : (
                <Database className="size-4" />
              )
            }
            onClick={() =>
              void controller.runAction(action).catch(() => undefined)
            }
          />
        ))}
      </div>
    </div>
  </div>
);

const HistoryContent = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) =>
  controller.historyRuns.length === 0 ? (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      Voor deze opdracht is nog geen Inzyte-analyse uitgevoerd.
    </div>
  ) : (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {controller.historyRuns.map((run: InzyteRun) => (
        <button
          key={run.id}
          type="button"
          className="rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted/40"
          onClick={() => controller.openHistoryResult(run)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="font-medium">
              {ACTION_LABELS[run.action] || humanizeInzyteField(run.action)}
            </div>
            <Badge
              variant="outline"
              className={
                run.status === "success"
                  ? "border-emerald-500/40 text-emerald-600"
                  : run.status === "failed"
                    ? "border-rose-500/40 text-rose-600"
                    : ""
              }
            >
              {run.status === "success"
                ? "Afgerond"
                : run.status === "failed"
                  ? "Mislukt"
                  : "Bezig"}
            </Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(run.started_at).toLocaleString("nl-NL")}
            {run.date_start && run.date_end
              ? ` · ${run.date_start} t/m ${run.date_end}`
              : ""}
          </div>
          {run.error ? (
            <div className="mt-2 text-sm text-rose-600">{run.error}</div>
          ) : null}
        </button>
      ))}
    </div>
  );

const WorkspaceAccordion = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => {
  if (!controller.bootstrap) return null;
  return (
    <Accordion
      type="multiple"
      className="overflow-hidden rounded-2xl border bg-card px-5 shadow-sm"
    >
      <AccordionItem value="question">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-3">
            <Bot className="size-5 text-sky-500" />
            <span>
              <span className="block font-semibold">
                Stel een vraag aan de klantdata
              </span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Vraag in gewone Nederlandse taal om een verklaring of advies.
              </span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <QuestionContent controller={controller} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="more">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-3">
            <Braces className="size-5 text-violet-500" />
            <span>
              <span className="block font-semibold">
                Meer analyses en specialistische functies
              </span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Alle overige Inzyte-functies blijven hier bereikbaar.
              </span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <MoreAnalysisContent controller={controller} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="connections">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-3">
            <Settings2 className="size-5 text-emerald-500" />
            <span>
              <span className="block font-semibold">
                Koppelingen en instellingen
              </span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Beheer GA4, Search Console, Bedrijfsprofiel en Google Ads.
              </span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <InzyteConnections
            key={controller.connectionsKey}
            bootstrap={controller.bootstrap}
            sources={controller.sources}
            busy={controller.busy}
            onLoadSources={controller.loadSources}
            onOauth={controller.openOauth}
            onSave={controller.saveLink}
            onUnlink={controller.unlink}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="history">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-3">
            <History className="size-5 text-amber-500" />
            <span>
              <span className="block font-semibold">Eerdere analyses</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {controller.historyRuns.length} opgeslagen Inzyte-
                {controller.historyRuns.length === 1
                  ? "resultaat"
                  : "resultaten"}
              </span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <HistoryContent controller={controller} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const UnlinkedContent = ({
  controller,
}: {
  controller: InzyteWorkspaceController;
}) => {
  if (!controller.bootstrap) return null;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 size-5 text-amber-600" />
          <div>
            <h2 className="font-semibold">
              Koppel deze opdracht eerst aan Inzyte
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Selecteer hieronder het juiste klantaccount en de Google-bronnen.
              Daarna verschijnen op deze ene pagina de klantupdate, PDF en alle
              analyses.
            </p>
          </div>
        </div>
      </div>
      <InzyteConnections
        key={controller.connectionsKey}
        bootstrap={controller.bootstrap}
        sources={controller.sources}
        busy={controller.busy}
        onLoadSources={controller.loadSources}
        onOauth={controller.openOauth}
        onSave={controller.saveLink}
        onUnlink={controller.unlink}
      />
    </div>
  );
};

export const InzyteWorkspaceContent = ({
  record,
  controller,
}: {
  record: Deal;
  controller: InzyteWorkspaceController;
}) => (
  <div className="min-h-0 flex-1 overflow-y-auto bg-muted/5">
    <div className="mx-auto w-full max-w-[1800px] space-y-5 p-4 pb-12 md:p-6">
      {controller.linked ? (
        <>
          <DateBar controller={controller} />
          <PrimaryOutput controller={controller} />
          <AnalysisGrid controller={controller} />
          <ResultSection record={record} controller={controller} />
          <WorkspaceAccordion controller={controller} />
        </>
      ) : (
        <UnlinkedContent controller={controller} />
      )}
    </div>
  </div>
);
