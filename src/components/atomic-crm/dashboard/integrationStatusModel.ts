import type { IntegrationRun } from "../types";

const RUN_TIMEOUT_MS = 10 * 60 * 1000;

export type IntegrationHealth = {
  label: string;
  description: string;
  tone: "success" | "warning" | "danger" | "running";
};

/**
 * Elke koppeling verwerkt iets anders. De woorden stonden eerst als
 * Gmail-of-anders in de zinnen zelf, waardoor een derde koppeling automatisch
 * "Trello-kaarten" zou heten.
 */
type IntegrationWords = {
  name: string;
  running: string;
  singular: string;
  plural: string;
};

const WORDS: Record<string, IntegrationWords> = {
  trello: {
    name: "Trello",
    running: "Trello-updates",
    singular: "kaart",
    plural: "kaarten",
  },
  gmail: {
    name: "Gmail",
    running: "Gmail-berichten",
    singular: "bericht",
    plural: "berichten",
  },
  inzyte: {
    name: "De maandrapportage",
    running: "Maandrapportages",
    singular: "rapportage",
    plural: "rapportages",
  },
};

const wordsFor = (integration: string): IntegrationWords =>
  WORDS[integration] ?? {
    name: integration,
    running: "Gegevens",
    singular: "item",
    plural: "items",
  };

export const getIntegrationHealth = (
  run: IntegrationRun,
  now = Date.now(),
): IntegrationHealth => {
  const words = wordsFor(run.integration);
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
      description: `${words.running} worden nu verwerkt.`,
      tone: "running",
    };
  }
  if (run.status === "partial") {
    return {
      label: "Aandacht nodig",
      description: `${run.failed_count} ${run.failed_count === 1 ? words.singular : words.plural} niet verwerkt.`,
      tone: "warning",
    };
  }
  if (run.status === "failed") {
    return {
      label: "Synchronisatie mislukt",
      description: `${words.name} is niet volledig bijgewerkt.`,
      tone: "danger",
    };
  }
  return {
    label: "Bijgewerkt",
    description: `${run.items_processed} ${run.items_processed === 1 ? words.singular : words.plural} verwerkt zonder fouten.`,
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
