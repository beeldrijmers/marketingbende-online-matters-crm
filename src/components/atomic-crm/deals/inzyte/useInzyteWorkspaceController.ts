import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";

import type { CrmDataProvider } from "../../providers/types";
import type {
  Deal,
  InzyteBootstrap,
  InzyteRequest,
  InzyteRun,
} from "../../types";
import type { InzyteLinkDraft } from "./InzyteConnections";
import { findNamedArray, unwrapInzyteData } from "./inzyteData";

export type ActionResult = {
  data: unknown;
  runId: number | null;
  completedAt: string;
  startDate?: string;
  endDate?: string;
};

export type GoogleProvider =
  | "ga4"
  | "search_console"
  | "business_profile"
  | "google_ads";

export type SectionType =
  | "traffic_comprehensive"
  | "user_behavior_comprehensive"
  | "ecommerce_comprehensive"
  | "geographic_comprehensive"
  | "demographics_comprehensive"
  | "content_comprehensive"
  | "realtime_comprehensive"
  | "trends_comprehensive";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

const defaultDates = () => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
};

const getRemoteAuthorizationUrl = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.authorizationUrl === "string") {
    return record.authorizationUrl;
  }
  if (record.data && typeof record.data === "object") {
    return getRemoteAuthorizationUrl(record.data);
  }
  return null;
};

export const useInzyteWorkspaceController = (record: Deal) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<InzyteBootstrap | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<unknown>({});
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [selectedAction, setSelectedAction] = useState("overview");
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
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Inzyte laden is mislukt",
        { type: "error" },
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
    setSelectedAction(action);
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
        startDate,
        endDate,
      };
      setResults((current) => ({ ...current, [action]: result }));
      return result;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Inzyte-opdracht mislukt",
        { type: "error" },
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
        { type: "error" },
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
      if (!authorizationUrl) {
        throw new Error("Google-koppeling kon niet starten.");
      }
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
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Koppeling opslaan is mislukt",
        { type: "error" },
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
      await dataProvider.inzyteRequest({ action: "unlink", dealId: record.id });
      setResults({});
      setSources({});
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await loadBootstrap();
      notify("De opdracht is losgekoppeld van Inzyte", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Loskoppelen is mislukt",
        { type: "error" },
      );
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async (runId: number, noteText: string) => {
    setBusy("save_note");
    try {
      const response = await dataProvider.inzyteRequest<{
        noteId: number;
        alreadyExisted: boolean;
        updated?: boolean;
      }>({ action: "save_note", dealId: record.id, runId, noteText });
      notify(
        response.updated
          ? "De klantupdate is bijgewerkt bij de opdracht"
          : response.alreadyExisted
            ? "Deze klantupdate stond al bij de opdracht"
            : "De klantupdate is bij de opdracht opgeslagen",
        { type: "success" },
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Klantupdate opslaan is mislukt",
        { type: "error" },
      );
    } finally {
      setBusy(null);
    }
  };

  const runAudience = async (
    action: "audience" | "audience_intelligence" = "audience",
  ) => {
    try {
      const traffic = results.traffic || (await runAction("traffic"));
      const rawTraffic = unwrapInzyteData(traffic.data);
      const trafficRecord =
        rawTraffic &&
        typeof rawTraffic === "object" &&
        !Array.isArray(rawTraffic)
          ? (rawTraffic as Record<string, unknown>)
          : {};
      await runAction(action, {
        payload: {
          visitorData: {
            ...trafficRecord,
            totalVisitors:
              trafficRecord.totalVisitors ?? trafficRecord.totalUsers ?? 0,
          },
          comprehensiveData: trafficRecord,
        },
      });
    } catch {
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
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
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
    }
  };

  const runSectionAnalysis = async (sectionType: SectionType) => {
    try {
      const overview = results.overview || (await runAction("overview"));
      await runAction("section_analysis", {
        payload: { sectionType, data: unwrapInzyteData(overview.data) },
      });
    } catch {
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
    }
  };

  const runAiInsights = async () => {
    try {
      const overview = results.overview || (await runAction("overview"));
      await runAction("ai_insights", {
        payload: { analyticsData: unwrapInzyteData(overview.data) },
        forceRefresh: true,
      });
    } catch {
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
    }
  };

  const runContextualAi = async (
    action: "executive_summary" | "strategic_recommendations",
  ) => {
    try {
      const overview = results.overview || (await runAction("overview"));
      const analyticsData = unwrapInzyteData(overview.data);
      await runAction(action, {
        payload:
          action === "executive_summary"
            ? { analyticsData, forceRefresh: true }
            : { data: analyticsData },
      });
    } catch {
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
    }
  };

  const runConversionAdvice = async () => {
    try {
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
      // De onderliggende acties tonen zelf een Nederlandse foutmelding.
    }
  };

  const linked = Boolean(bootstrap?.link);
  const hasGa4 = Boolean(
    bootstrap?.link?.ga4_connection_id && bootstrap?.link?.ga4_property_id,
  );
  const historyRuns = bootstrap?.recentRuns || [];
  const selectedResult = results[selectedAction];
  const connectionsKey = `${bootstrap?.link?.id || "new"}-${
    bootstrap?.suggestedLink?.id || "none"
  }-${bootstrap?.workspaces.length || 0}`;

  const openHistoryResult = (run: InzyteRun) => {
    setSelectedAction("history");
    setResults((current) => ({
      ...current,
      history: {
        data: run.result || run.summary,
        runId: run.id,
        completedAt: run.finished_at || run.started_at,
        startDate: run.date_start || undefined,
        endDate: run.date_end || undefined,
      },
    }));
  };

  return {
    open,
    setOpen,
    bootstrap,
    loadingBootstrap,
    busy,
    sources,
    selectedAction,
    selectedResult,
    question,
    setQuestion,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    linked,
    hasGa4,
    historyRuns,
    connectionsKey,
    loadBootstrap,
    loadSources,
    openOauth,
    saveLink,
    unlink,
    saveNote,
    runAction,
    runAudience,
    runStructuredAi,
    runSectionAnalysis,
    runAiInsights,
    runContextualAi,
    runConversionAdvice,
    openHistoryResult,
  };
};

export type InzyteWorkspaceController = ReturnType<
  typeof useInzyteWorkspaceController
>;
