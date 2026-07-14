import type { IntegrationRun } from "../types";

const RUN_TIMEOUT_MS = 10 * 60 * 1000;

export type IntegrationHealth = {
  label: string;
  description: string;
  tone: "success" | "warning" | "danger" | "running";
};

export const getIntegrationHealth = (
  run: IntegrationRun,
  now = Date.now(),
): IntegrationHealth => {
  if (
    run.status === "running" &&
    now - new Date(run.started_at).getTime() > RUN_TIMEOUT_MS
  ) {
    return {
      label: "Loopt ongewoon lang",
      description:
        "Controleer de koppeling of start de synchronisatie opnieuw.",
      tone: "warning",
    };
  }
  if (run.status === "running") {
    return {
      label: "Synchroniseert",
      description: "Trello-updates worden nu verwerkt.",
      tone: "running",
    };
  }
  if (run.status === "partial") {
    return {
      label: "Aandacht nodig",
      description: `${run.failed_count} kaart${run.failed_count === 1 ? "" : "en"} niet verwerkt.`,
      tone: "warning",
    };
  }
  if (run.status === "failed") {
    return {
      label: "Synchronisatie mislukt",
      description: "Trello is niet volledig bijgewerkt.",
      tone: "danger",
    };
  }
  return {
    label: "Bijgewerkt",
    description: `${run.items_processed} kaarten verwerkt zonder fouten.`,
    tone: "success",
  };
};

export const formatIntegrationRunDate = (date: string): string =>
  new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
