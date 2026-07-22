import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bot,
  Braces,
  CheckCircle2,
  CircleHelp,
  Clipboard,
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
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CrmDataProvider } from "../../providers/types";
import type {
  Deal,
  InzyteBootstrap,
  InzyteRequest,
  InzyteRun,
} from "../../types";
import { InzyteConnections, type InzyteLinkDraft } from "./InzyteConnections";
import { InzyteDataView } from "./InzyteDataView";
import { findNamedArray, unwrapInzyteData } from "./inzyteData";

type WorkspaceTab =
  | "overview"
  | "live"
  | "traffic"
  | "pages"
  | "conversions"
  | "seo"
  | "campaigns"
  | "audience"
  | "ai"
  | "question"
  | "report"
  | "technical"
  | "connections"
  | "history";

type ActionResult = {
  data: unknown;
  runId: number | null;
  completedAt: string;
};

type GoogleProvider =
  | "ga4"
  | "search_console"
  | "business_profile"
  | "google_ads";

type SectionType =
  | "traffic_comprehensive"
  | "user_behavior_comprehensive"
  | "ecommerce_comprehensive"
  | "geographic_comprehensive"
  | "demographics_comprehensive"
  | "content_comprehensive"
  | "realtime_comprehensive"
  | "trends_comprehensive";

const TAB_ITEMS: Array<{
  value: WorkspaceTab;
  label: string;
  icon: typeof Gauge;
}> = [
  { value: "overview", label: "Overzicht", icon: Gauge },
  { value: "live", label: "Live", icon: Radio },
  { value: "traffic", label: "Verkeer", icon: BarChart3 },
  { value: "pages", label: "Pagina’s", icon: Globe2 },
  { value: "conversions", label: "Conversies", icon: Target },
  { value: "seo", label: "SEO / GSC", icon: Search },
  { value: "campaigns", label: "Campagnes", icon: Megaphone },
  { value: "audience", label: "Doelgroep", icon: Users },
  { value: "ai", label: "AI-inzichten", icon: Sparkles },
  { value: "question", label: "Vraagbaak", icon: CircleHelp },
  { value: "report", label: "Rapportage", icon: FileBarChart },
  { value: "technical", label: "Techniek", icon: Braces },
  { value: "connections", label: "Koppelingen", icon: Link2 },
  { value: "history", label: "Historie", icon: History },
];

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
  report: "Rapportage",
  trend: "Dagelijkse trend",
  realtime: "Live verkeer",
  traffic: "Verkeersanalyse",
  pages: "Pagina-analyse",
  conversions: "Conversies",
  events: "Gebeurtenissen",
  campaigns: "UTM-campagnes",
  highlights: "Data-highlights",
  source_products: "Bronproducten",
  detailed: "Verdiepende analyse",
  custom_dimensions: "Aangepaste dimensies",
  annotations: "Annotaties",
  search_console: "Search Console",
  business_profile: "Bedrijfsprofiel",
  google_ads: "Google Ads",
  ai_insights: "AI-inzichten",
  audience: "Doelgroepanalyse",
  audience_intelligence: "Doelgroepintelligentie",
  kpi_insights: "AI KPI-inzichten",
  practical_recommendations: "Praktische aanbevelingen",
  comprehensive_analysis: "Uitgebreide AI-analyse",
  deep_analysis: "Strategische diepte-analyse",
  section_analysis: "AI-sectieanalyse",
  conversion_analysis: "Conversieadvies",
  executive_summary: "Managementsamenvatting",
  strategic_recommendations: "Strategische aanbevelingen",
  vraagbaak: "Vraagbaak",
};

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

const defaultDates = () => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
};

const stopCardEvent = (event: React.SyntheticEvent) => event.stopPropagation();

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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
  `"${String(
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : value,
  ).replaceAll('"', '""')}"`;

const resultToCsv = (data: unknown): string | null => {
  const rows = findNamedArray(unwrapInzyteData(data), []);
  if (rows.length === 0) return null;
  const columns = Array.from(
    new Set(rows.slice(0, 100).flatMap((row) => Object.keys(row))),
  ).slice(0, 30);
  return [
    columns.map(csvCell).join(","),
    ...rows
      .slice(0, 5_000)
      .map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
};

const getRemoteAuthorizationUrl = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.authorizationUrl === "string")
    return record.authorizationUrl;
  if (record.data && typeof record.data === "object") {
    return getRemoteAuthorizationUrl(record.data);
  }
  return null;
};

const ResultToolbar = ({
  result,
  dealName,
  action,
  busy,
  onSaveNote,
}: {
  result: ActionResult;
  dealName: string;
  action: string;
  busy: string | null;
  onSaveNote: (runId: number) => void;
}) => {
  const filename = `${safeFilename(dealName)}-${safeFilename(action)}`;
  const handlePrint = () => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    const title = `${ACTION_LABELS[action] || action} · ${dealName}`;
    popup.document.write(
      `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px/1.55 system-ui;margin:40px;color:#18181b}h1{font-size:24px}pre{white-space:pre-wrap;word-break:break-word;background:#f4f4f5;padding:20px;border-radius:12px}@media print{body{margin:18mm}}</style></head><body><h1>${escapeHtml(title)}</h1><p>Gegenereerd op ${escapeHtml(new Date(result.completedAt).toLocaleString("nl-NL"))}</p><pre>${escapeHtml(JSON.stringify(unwrapInzyteData(result.data), null, 2))}</pre><script>window.print()</script></body></html>`,
    );
    popup.document.close();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
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
        <Download className="size-4" /> JSON
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const csv = resultToCsv(result.data);
          if (csv) {
            downloadBlob(csv, "text/csv;charset=utf-8", `${filename}.csv`);
          }
        }}
      >
        <Download className="size-4" /> CSV
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handlePrint}>
        <Printer className="size-4" /> Afdrukken / PDF
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(
            JSON.stringify(unwrapInzyteData(result.data), null, 2),
          )
        }
      >
        <Clipboard className="size-4" /> Kopiëren
      </Button>
      {result.runId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={busy === "save_note"}
          onClick={() => onSaveNote(result.runId!)}
        >
          {busy === "save_note" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageSquareText className="size-4" />
          )}
          Als voortgang opslaan
        </Button>
      ) : null}
    </div>
  );
};

const ActionPanel = ({
  title,
  description,
  icon,
  action,
  buttonLabel,
  result,
  busy,
  disabled,
  dealName,
  onRun,
  onSaveNote,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  action: string;
  buttonLabel: string;
  result?: ActionResult;
  busy: string | null;
  disabled?: boolean;
  dealName: string;
  onRun: () => void;
  onSaveNote: (runId: number) => void;
  children?: ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-5">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <Button
        type="button"
        disabled={disabled || busy !== null}
        onClick={onRun}
      >
        {busy === action ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {buttonLabel}
      </Button>
    </div>
    {children}
    {result ? (
      <>
        <ResultToolbar
          result={result}
          dealName={dealName}
          action={action}
          busy={busy}
          onSaveNote={onSaveNote}
        />
        <InzyteDataView data={result.data} />
      </>
    ) : (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Kies ‘{buttonLabel}’ om actuele klantdata uit Inzyte op te halen.
      </div>
    )}
  </div>
);

const MultiActionButtons = ({
  actions,
  busy,
  onRun,
}: {
  actions: string[];
  busy: string | null;
  onRun: (action: string) => void;
}) => (
  <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
    {actions.map((action) => (
      <Button
        key={action}
        type="button"
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => onRun(action)}
      >
        {busy === action ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Activity className="size-4" />
        )}
        {ACTION_LABELS[action] || action}
      </Button>
    ))}
  </div>
);

export const InzyteWorkspace = ({ record }: { record: Deal }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<InzyteBootstrap | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<unknown>({});
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [visibleConversionResult, setVisibleConversionResult] =
    useState("conversions");
  const [visibleAiResult, setVisibleAiResult] = useState("ai_insights");
  const [visibleTechnicalResult, setVisibleTechnicalResult] =
    useState("events");
  const [visibleCampaignResult, setVisibleCampaignResult] =
    useState("campaigns");
  const [visibleAudienceResult, setVisibleAudienceResult] =
    useState("audience");
  const [question, setQuestion] = useState(
    "Wat zijn voor deze klant de drie belangrijkste kansen en welke concrete acties moeten we als eerste uitvoeren?",
  );
  const initialDates = useMemo(defaultDates, []);
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);

  const loadBootstrap = useCallback(async () => {
    setLoadingBootstrap(true);
    try {
      const response = await dataProvider.inzyteRequest<InzyteBootstrap>({
        action: "bootstrap",
        dealId: record.id,
      });
      setBootstrap(response);
      if (!response.link) setActiveTab("connections");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Inzyte laden is mislukt",
        {
          type: "error",
        },
      );
    } finally {
      setLoadingBootstrap(false);
    }
  }, [dataProvider, notify, record.id]);

  useEffect(() => {
    if (open) void loadBootstrap();
  }, [loadBootstrap, open]);

  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://inzyte.io") return;
      if (
        !event.data ||
        typeof event.data !== "object" ||
        event.data.type !== "inzyte-oauth-complete"
      ) {
        return;
      }
      notify(
        event.data.status === "success"
          ? "Google-koppeling voltooid. Haal de bronnen opnieuw op."
          : "Google-koppeling is niet voltooid.",
        { type: event.data.status === "success" ? "success" : "warning" },
      );
      void loadBootstrap();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadBootstrap, notify, open]);

  const runAction = async (
    action: string,
    extra: Partial<InzyteRequest> = {},
  ): Promise<ActionResult> => {
    setBusy(action);
    try {
      const response = await dataProvider.inzyteRequest<{
        result: unknown;
        runId: number | null;
      }>({
        action,
        dealId: record.id,
        startDate,
        endDate,
        ...extra,
      });
      const result = {
        data: response.result,
        runId: response.runId,
        completedAt: new Date().toISOString(),
      };
      setResults((current) => ({ ...current, [action]: result }));
      return result;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Inzyte-opdracht mislukt",
        {
          type: "error",
        },
      );
      throw error;
    } finally {
      setBusy(null);
    }
  };

  const loadSources = async (draft: InzyteLinkDraft) => {
    setBusy("sources");
    try {
      const response = await dataProvider.inzyteRequest({
        action: "setup_sources",
        dealId: record.id,
        inzyteUserId: draft.inzyteUserId,
        ga4ConnectionId: draft.ga4ConnectionId,
      });
      setSources(response);
      notify("Beschikbare Inzyte-bronnen zijn bijgewerkt", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Bronnen ophalen is mislukt",
        {
          type: "error",
        },
      );
    } finally {
      setBusy(null);
    }
  };

  const openOauth = async (
    provider: GoogleProvider,
    draft: InzyteLinkDraft,
  ) => {
    setBusy(`oauth:${provider}`);
    try {
      const response = await dataProvider.inzyteRequest({
        action: "oauth_url",
        dealId: record.id,
        inzyteUserId: draft.inzyteUserId,
        provider,
      });
      const authorizationUrl = getRemoteAuthorizationUrl(response);
      if (!authorizationUrl)
        throw new Error("Google-koppeling kon niet starten.");
      const popup = window.open(
        authorizationUrl,
        `inzyte-${provider}`,
        "popup,width=720,height=820,noopener=no,noreferrer=no",
      );
      if (!popup) throw new Error("Sta pop-ups toe om Google te koppelen.");
      popup.focus();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Koppelen is mislukt", {
        type: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const saveLink = async (draft: InzyteLinkDraft) => {
    setBusy("save");
    try {
      await dataProvider.inzyteRequest({
        action: "save_link",
        dealId: record.id,
        ...draft,
      });
      notify("Inzyte is aan deze opdracht gekoppeld", { type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await loadBootstrap();
      setActiveTab("overview");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Koppeling opslaan is mislukt",
        {
          type: "error",
        },
      );
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    if (
      !window.confirm(
        "Alleen de koppeling met deze opdracht verwijderen? Inzyte zelf blijft intact.",
      )
    ) {
      return;
    }
    setBusy("unlink");
    try {
      await dataProvider.inzyteRequest({
        action: "unlink",
        dealId: record.id,
      });
      setResults({});
      setSources({});
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await loadBootstrap();
      notify("De opdracht is losgekoppeld van Inzyte", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Loskoppelen is mislukt",
        {
          type: "error",
        },
      );
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async (runId: number) => {
    setBusy("save_note");
    try {
      const response = await dataProvider.inzyteRequest<{
        noteId: number;
        alreadyExisted: boolean;
      }>({ action: "save_note", dealId: record.id, runId });
      notify(
        response.alreadyExisted
          ? "Deze Inzyte-update stond al bij de voortgang"
          : "Inzyte-resultaat is als voortgang opgeslagen",
        { type: "success" },
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Voortgang opslaan is mislukt",
        {
          type: "error",
        },
      );
    } finally {
      setBusy(null);
    }
  };

  const runAudience = async (
    action: "audience" | "audience_intelligence" = "audience",
  ) => {
    try {
      setVisibleAudienceResult(action);
      const traffic = results.traffic || (await runAction("traffic"));
      const rawTraffic = unwrapInzyteData(traffic.data);
      const trafficRecord =
        rawTraffic &&
        typeof rawTraffic === "object" &&
        !Array.isArray(rawTraffic)
          ? (rawTraffic as Record<string, unknown>)
          : {};
      const visitorData = {
        ...trafficRecord,
        totalVisitors:
          trafficRecord.totalVisitors ?? trafficRecord.totalUsers ?? 0,
      };
      await runAction(action, {
        payload: {
          visitorData,
          comprehensiveData: trafficRecord,
        },
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const runStructuredAi = async (
    action:
      | "kpi_insights"
      | "practical_recommendations"
      | "comprehensive_analysis"
      | "deep_analysis",
  ) => {
    try {
      setVisibleAiResult(action);
      const overview = results.overview || (await runAction("overview"));
      const kpiData = unwrapInzyteData(overview.data);
      await runAction(action, {
        payload: {
          kpiData,
          analyticsData: kpiData,
          dateRange: { startDate, endDate },
          businessContext: `Opdracht: ${record.name}`,
          detailedAnalytics: results.detailed
            ? unwrapInzyteData(results.detailed.data)
            : undefined,
          dataHighlights: results.highlights
            ? unwrapInzyteData(results.highlights.data)
            : undefined,
          aiInsights: results.ai_insights
            ? unwrapInzyteData(results.ai_insights.data)
            : undefined,
        },
        forceRefresh: true,
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const runSectionAnalysis = async (sectionType: SectionType) => {
    try {
      setVisibleAiResult("section_analysis");
      const overview = results.overview || (await runAction("overview"));
      await runAction("section_analysis", {
        payload: {
          sectionType,
          data: unwrapInzyteData(overview.data),
        },
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const runAiInsights = async () => {
    try {
      setVisibleAiResult("ai_insights");
      const overview = results.overview || (await runAction("overview"));
      await runAction("ai_insights", {
        payload: { analyticsData: unwrapInzyteData(overview.data) },
        forceRefresh: true,
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const runContextualAi = async (
    action: "executive_summary" | "strategic_recommendations",
  ) => {
    try {
      setVisibleAiResult(action);
      const overview = results.overview || (await runAction("overview"));
      const analyticsData = unwrapInzyteData(overview.data);
      await runAction(action, {
        payload:
          action === "executive_summary"
            ? { analyticsData, forceRefresh: true }
            : { data: analyticsData },
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const runConversionAdvice = async () => {
    try {
      setVisibleConversionResult("conversion_analysis");
      const conversions =
        results.conversions || (await runAction("conversions"));
      const pages = results.pages || (await runAction("pages"));
      await runAction("conversion_analysis", {
        payload: {
          conversionData: {
            conversions: unwrapInzyteData(conversions.data),
            topPages: findNamedArray(unwrapInzyteData(pages.data), [
              "pages",
              "landingPages",
              "rows",
            ]),
          },
          websiteUrl: bootstrap?.link?.website_url,
        },
      });
    } catch {
      // Both calls already surface a precise Dutch error.
    }
  };

  const linked = Boolean(bootstrap?.link);
  const hasGa4 = Boolean(
    bootstrap?.link?.ga4_connection_id && bootstrap?.link?.ga4_property_id,
  );
  const historyRuns = bootstrap?.recentRuns || [];
  const connectionsKey = `${bootstrap?.link?.id || "new"}-${bootstrap?.suggestedLink?.id || "none"}-${bootstrap?.workspaces.length || 0}`;

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Uitgevoerde Inzyte-opdrachten</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Resultaten blijven per opdracht bewaard. Open een moment om de
          opgeslagen brondata terug te zien.
        </p>
      </div>
      {historyRuns.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Voor deze opdracht is nog geen Inzyte-analyse uitgevoerd.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {historyRuns.map((run: InzyteRun) => (
            <button
              key={run.id}
              type="button"
              className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
              onClick={() => {
                setResults((current) => ({
                  ...current,
                  history: {
                    data: run.result || run.summary,
                    runId: run.id,
                    completedAt: run.finished_at || run.started_at,
                  },
                }));
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">
                  {ACTION_LABELS[run.action] || run.action}
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
      )}
      {results.history ? (
        <>
          <ResultToolbar
            result={results.history}
            dealName={record.name}
            action="historie"
            busy={busy}
            onSaveNote={saveNote}
          />
          <InzyteDataView data={results.history.data} />
        </>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[11px]"
          onClick={stopCardEvent}
          onPointerDown={stopCardEvent}
        >
          <BarChart3 className="size-3.5 text-sky-500" />
          {record.inzyte_link ? "Open" : "Koppelen"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-cols-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        onClick={stopCardEvent}
        onPointerDown={stopCardEvent}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
              <BarChart3 className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl">
                Inzyte-werkcentrum · {record.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Analyseer, adviseer en rapporteer voor deze klant zonder
                Inzyte.io te openen.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-4">
              {linked ? (
                <Badge className="gap-1 bg-emerald-600 text-white">
                  <CheckCircle2 className="size-3.5" /> Opdracht gekoppeld
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-600"
                >
                  <Link2 className="size-3.5" /> Koppeling nodig
                </Badge>
              )}
              {bootstrap?.link?.last_error ? (
                <Badge variant="destructive">Koppeling vraagt aandacht</Badge>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {loadingBootstrap && !bootstrap ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-sky-500" />
              <p className="mt-3 text-sm text-muted-foreground">
                Klantkoppelingen en historie laden…
              </p>
            </div>
          </div>
        ) : bootstrap ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
            className="min-h-0 flex-1 gap-0"
          >
            <div className="shrink-0 border-b bg-muted/20 px-4 py-2">
              <TabsList className="h-auto max-w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                {TAB_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="h-9 flex-none px-3 data-[state=active]:border data-[state=active]:bg-background"
                    >
                      <Icon className="size-4" /> {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {activeTab !== "connections" && activeTab !== "history" ? (
              <div className="shrink-0 border-b bg-background px-5 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Analyseperiode
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-8 w-40"
                  />
                  <span className="text-xs text-muted-foreground">t/m</span>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-8 w-40"
                  />
                  <Badge variant="outline" className="ml-auto">
                    {bootstrap.deal.companyName || "Geen bedrijfsnaam"}
                  </Badge>
                  {hasGa4 ? (
                    <Badge variant="secondary">
                      GA4 ·{" "}
                      {bootstrap.link?.ga4_property_name ||
                        bootstrap.link?.ga4_property_id}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("connections")}
                    >
                      <Settings2 className="size-4" /> GA4 instellen
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/5">
              <div className="mx-auto w-full max-w-[1800px] p-4 md:p-6">
                <TabsContent value="overview" className="m-0">
                  <ActionPanel
                    title="Volledig klantoverzicht"
                    description="Kerncijfers, vergelijking met de vorige periode, kanalen, toppagina’s en dagelijkse ontwikkeling in één bruikbaar klantbeeld."
                    icon={<Gauge className="size-6" />}
                    action="overview"
                    buttonLabel="Klantoverzicht ophalen"
                    result={results.overview}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("overview").catch(() => undefined)
                    }
                    onSaveNote={saveNote}
                  >
                    <MultiActionButtons
                      actions={["report", "trend", "business_profile"]}
                      busy={busy}
                      onRun={(action) =>
                        void runAction(action).catch(() => undefined)
                      }
                    />
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="live" className="m-0">
                  <ActionPanel
                    title="Wat gebeurt er nu?"
                    description="Actieve bezoekers, bekeken pagina’s, events, apparaten, herkomst en locaties uit de realtime GA4-rapportage."
                    icon={<Radio className="size-6" />}
                    action="realtime"
                    buttonLabel="Live data ophalen"
                    result={results.realtime}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("realtime").catch(() => undefined)
                    }
                    onSaveNote={saveNote}
                  />
                </TabsContent>

                <TabsContent value="traffic" className="m-0">
                  <ActionPanel
                    title="Verkeer en bezoekersgedrag"
                    description="Volledige verkeersanalyse met trends, acquisitiekanalen, geografie, technologie, apparaten en taal."
                    icon={<BarChart3 className="size-6" />}
                    action="traffic"
                    buttonLabel="Verkeer analyseren"
                    result={results.traffic}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("traffic").catch(() => undefined)
                    }
                    onSaveNote={saveNote}
                  >
                    <MultiActionButtons
                      actions={["trend", "detailed"]}
                      busy={busy}
                      onRun={(action) =>
                        void runAction(action).catch(() => undefined)
                      }
                    />
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="pages" className="m-0">
                  <ActionPanel
                    title="Pagina’s en landingspagina’s"
                    description="Vind pagina’s die verkeer aantrekken, betrokkenheid verliezen of kansen bieden voor content, UX en conversie."
                    icon={<Globe2 className="size-6" />}
                    action="pages"
                    buttonLabel="Pagina’s analyseren"
                    result={results.pages}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => void runAction("pages").catch(() => undefined)}
                    onSaveNote={saveNote}
                  />
                </TabsContent>

                <TabsContent value="conversions" className="m-0">
                  <ActionPanel
                    title="Conversies, doelen en events"
                    description="Controleer welke acties resultaat opleveren, waar conversie uitvalt en welke events of doelen aandacht nodig hebben."
                    icon={<Target className="size-6" />}
                    action={visibleConversionResult}
                    buttonLabel="Conversies ophalen"
                    result={results[visibleConversionResult]}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => {
                      setVisibleConversionResult("conversions");
                      void runAction("conversions").catch(() => undefined);
                    }}
                    onSaveNote={saveNote}
                  >
                    <MultiActionButtons
                      actions={["events", "conversion_analysis"]}
                      busy={busy}
                      onRun={(action) => {
                        if (action === "conversion_analysis") {
                          void runConversionAdvice();
                          return;
                        }
                        setVisibleConversionResult(action);
                        void runAction(action).catch(() => undefined);
                      }}
                    />
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="seo" className="m-0">
                  <ActionPanel
                    title="SEO en Google Search Console"
                    description="Zoekopdrachten, klikken, vertoningen, CTR, gemiddelde posities en presterende pagina’s voor precies de gekoppelde klantwebsite."
                    icon={<Search className="size-6" />}
                    action="search_console"
                    buttonLabel="SEO-data ophalen"
                    result={results.search_console}
                    busy={busy}
                    disabled={!linked || !bootstrap.link?.gsc_site_url}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("search_console", {
                        forceRefresh: true,
                      }).catch(() => undefined)
                    }
                    onSaveNote={saveNote}
                  >
                    {!bootstrap.link?.gsc_site_url ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                        Selecteer eerst een Search Console-site bij Koppelingen.
                      </div>
                    ) : null}
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="campaigns" className="m-0">
                  <ActionPanel
                    title="Campagnes, UTM en advertentieresultaat"
                    description="Combineer GA4-campagnes en UTM-verkeer met Google Ads-kosten, klikken, conversies, CPA en ROAS."
                    icon={<Megaphone className="size-6" />}
                    action={visibleCampaignResult}
                    buttonLabel="Campagnes analyseren"
                    result={results[visibleCampaignResult]}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => {
                      setVisibleCampaignResult("campaigns");
                      void runAction("campaigns").catch(() => undefined);
                    }}
                    onSaveNote={saveNote}
                  >
                    <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          busy !== null || !bootstrap.link?.ads_customer_id
                        }
                        onClick={() => {
                          setVisibleCampaignResult("google_ads");
                          void runAction("google_ads", {
                            forceRefresh: true,
                          }).catch(() => undefined);
                        }}
                      >
                        <MousePointerClick className="size-4" /> Google Ads
                        ophalen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => {
                          setVisibleCampaignResult("source_products");
                          void runAction("source_products").catch(
                            () => undefined,
                          );
                        }}
                      >
                        <ListChecks className="size-4" /> Bronproducten
                      </Button>
                    </div>
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="audience" className="m-0">
                  <ActionPanel
                    title="Doelgroep, persona’s en kanalen"
                    description="Inzyte combineert bezoekersdata met de klantwebsite en maakt er een doelgroepbeschrijving, segmenten, persona’s, kanalen en concrete contentaanpak van."
                    icon={<Users className="size-6" />}
                    action={visibleAudienceResult}
                    buttonLabel="Doelgroep laten analyseren"
                    result={results[visibleAudienceResult]}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => void runAudience("audience")}
                    onSaveNote={saveNote}
                  >
                    <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() =>
                          void runAudience("audience_intelligence")
                        }
                      >
                        <Users className="size-4" /> Persona’s, segmenten en
                        contentstrategie
                      </Button>
                    </div>
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="ai" className="m-0">
                  <ActionPanel
                    title="AI-inzichten en advies"
                    description="Laat Inzyte actuele analytics vertalen naar kansen, waarschuwingen en acties voor verkeer, betrokkenheid, omzet en klantgroei."
                    icon={<Sparkles className="size-6" />}
                    action={visibleAiResult}
                    buttonLabel="AI-inzichten genereren"
                    result={results[visibleAiResult]}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => void runAiInsights()}
                    onSaveNote={saveNote}
                  >
                    <MultiActionButtons
                      actions={[
                        "highlights",
                        "executive_summary",
                        "strategic_recommendations",
                        "kpi_insights",
                        "practical_recommendations",
                        "comprehensive_analysis",
                        "deep_analysis",
                      ]}
                      busy={busy}
                      onRun={(action) => {
                        if (
                          action === "executive_summary" ||
                          action === "strategic_recommendations"
                        ) {
                          void runContextualAi(action);
                          return;
                        }
                        if (
                          action === "kpi_insights" ||
                          action === "practical_recommendations" ||
                          action === "comprehensive_analysis" ||
                          action === "deep_analysis"
                        ) {
                          void runStructuredAi(action);
                          return;
                        }
                        setVisibleAiResult(action);
                        void runAction(action).catch(() => undefined);
                      }}
                    />
                    <div className="rounded-xl border bg-card p-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        AI-verdieping per onderwerp
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SECTION_ITEMS.map(([sectionType, label]) => (
                          <Button
                            key={sectionType}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void runSectionAnalysis(sectionType)}
                          >
                            <Sparkles className="size-4" /> {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="question" className="m-0">
                  <ActionPanel
                    title="Vraagbaak met live klantdata"
                    description="Stel vrije vragen in het Nederlands. Inzyte kan zelf aanvullende GA4-queries uitvoeren en betrekt de geselecteerde periode bij het antwoord."
                    icon={<Bot className="size-6" />}
                    action="vraagbaak"
                    buttonLabel="Vraag stellen"
                    result={results.vraagbaak}
                    busy={busy}
                    disabled={!hasGa4 || question.trim().length === 0}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("vraagbaak", { question }).catch(
                        () => undefined,
                      )
                    }
                    onSaveNote={saveNote}
                  >
                    <div className="rounded-xl border bg-card p-4">
                      <Textarea
                        value={question}
                        maxLength={2_000}
                        rows={5}
                        placeholder="Vraag bijvoorbeeld: waarom daalde organisch verkeer en wat moeten we deze maand doen?"
                        onChange={(event) => setQuestion(event.target.value)}
                      />
                      <div className="mt-2 text-right text-xs text-muted-foreground">
                        {question.length}/2.000 tekens
                      </div>
                    </div>
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="report" className="m-0">
                  <ActionPanel
                    title="Klantrapportage"
                    description="Bouw een reproduceerbaar rapport met KPI’s, vorige periode, kanalen, toppagina’s en trend. Exporteer naar JSON, CSV of via de printfunctie naar PDF."
                    icon={<FileBarChart className="size-6" />}
                    action="report"
                    buttonLabel="Rapport opbouwen"
                    result={results.report}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() =>
                      void runAction("report").catch(() => undefined)
                    }
                    onSaveNote={saveNote}
                  />
                </TabsContent>

                <TabsContent value="technical" className="m-0">
                  <ActionPanel
                    title="Techniek en verdieping"
                    description="Roep ook de specialistische Inzyte-modules rechtstreeks op: events, dimensies, annotaties, bronproducten, data-highlights en verdiepende analyses."
                    icon={<Braces className="size-6" />}
                    action={visibleTechnicalResult}
                    buttonLabel="Gebeurtenissen ophalen"
                    result={results[visibleTechnicalResult]}
                    busy={busy}
                    disabled={!hasGa4}
                    dealName={record.name}
                    onRun={() => {
                      setVisibleTechnicalResult("events");
                      void runAction("events").catch(() => undefined);
                    }}
                    onSaveNote={saveNote}
                  >
                    <MultiActionButtons
                      actions={[
                        "custom_dimensions",
                        "annotations",
                        "source_products",
                        "highlights",
                        "detailed",
                      ]}
                      busy={busy}
                      onRun={(action) => {
                        setVisibleTechnicalResult(action);
                        void runAction(action).catch(() => undefined);
                      }}
                    />
                  </ActionPanel>
                </TabsContent>

                <TabsContent value="connections" className="m-0">
                  <InzyteConnections
                    key={connectionsKey}
                    bootstrap={bootstrap}
                    sources={sources}
                    busy={busy}
                    onLoadSources={loadSources}
                    onOauth={openOauth}
                    onSave={saveLink}
                    onUnlink={unlink}
                  />
                </TabsContent>

                <TabsContent value="history" className="m-0">
                  {renderHistory()}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Het Inzyte-werkcentrum kon niet worden geladen.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={loadBootstrap}
              >
                <RefreshCw className="size-4" /> Opnieuw proberen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const InzyteCardActions = ({ record }: { record: Deal }) => (
  <div
    className="mt-1 grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 border-t pt-1.5"
    onClick={stopCardEvent}
    onPointerDown={stopCardEvent}
    onKeyDown={stopCardEvent}
  >
    <div className="min-w-0">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <BarChart3 className="size-3.5 text-sky-500" />
        Inzyte-werkcentrum
        <span
          className={cn(
            "ml-0.5",
            record.inzyte_link?.last_error
              ? "text-rose-600"
              : record.inzyte_link
                ? "text-emerald-600"
                : "text-amber-600",
          )}
        >
          ·{" "}
          {record.inzyte_link?.last_error
            ? "aandacht nodig"
            : record.inzyte_link
              ? "gekoppeld"
              : "nog koppelen"}
        </span>
      </span>
      {record.inzyte_link ? (
        <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[9px] font-medium uppercase tracking-wide">
          {[
            [
              "GA4",
              Boolean(
                record.inzyte_link.ga4_connection_id &&
                  record.inzyte_link.ga4_property_id,
              ),
            ],
            ["GSC", Boolean(record.inzyte_link.gsc_site_url)],
            ["GBP", Boolean(record.inzyte_link.gbp_location_id)],
            ["Ads", Boolean(record.inzyte_link.ads_customer_id)],
          ].map(([label, active]) => (
            <span
              key={String(label)}
              className={
                active ? "text-emerald-600" : "text-muted-foreground/45"
              }
            >
              {label} {active ? "✓" : "—"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
    <InzyteWorkspace record={record} />
  </div>
);
