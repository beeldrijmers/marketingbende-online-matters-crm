import type { Meta } from "@storybook/react-vite";

import { StoryWrapper } from "@/test/StoryWrapper";
import { i18nProvider } from "../providers/commons/i18nProvider";
import type { Deal, IntegrationRun, Task } from "../types";
import { DashboardWorkspace } from "./DashboardWorkspace";

const meta = {
  title: "Atomic CRM/Dashboard/Trello workflow overview",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const card = (
  id: number,
  name: string,
  stage: string,
  deadline: string,
  index = Number.NaN,
): Deal => ({
  id,
  name,
  company_id: 1,
  contact_ids: [],
  category: name.includes("SEO") ? "seo" : "website-development",
  stage,
  description: null,
  amount: null,
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-21T20:00:00.000Z",
  expected_closing_date: deadline,
  delivery_date: deadline,
  trello_card_id: `trello-${id}`,
  activity_source: "trello",
  sales_id: 0,
  assignee_ids: [0],
  index,
  on_hold: stage === "on-hold",
  is_internal: false,
});

const deals: Deal[] = [
  card(
    1,
    "[LEAD] Kleine Woningen / Mosana — introductie bellen",
    "informatie-pipeline",
    "2026-07-24",
    0,
  ),
  card(
    2,
    "[SEO] Hunting XL — nieuwe scrape voorbereiden",
    "informatie-pipeline",
    "2026-07-31",
    1,
  ),
  card(
    3,
    "[WEBSITE] ASP Noard — laatste QA en oplevering",
    "bevestigd-inplannen",
    "2026-07-23",
  ),
  card(4, "[KLANT] Stookmeesters — wacht op input", "on-hold", "2026-07-31"),
  card(5, "[INTERN] Happr productontwikkeling", "bezig", "2026-07-31"),
  card(
    6,
    "[WEBSHOP] De Baron — laatste controle en klantakkoord",
    "controle-livegang",
    "2026-07-22",
  ),
  card(
    7,
    "[WEBSITE] Valora Incasso — gecontroleerde livegang",
    "controle-livegang",
    "2026-07-22",
  ),
  card(
    8,
    "[SEO MAAND] Juli 2026 — facturatie controleren",
    "facturatie-live",
    "2026-07-31",
  ),
  card(9, "[WEBSHOP] Hunting XL — webshop afgerond", "won", "2026-07-31"),
  card(10, "[SEO MAAND] Pansite — vaste klant", "maandelijks", "2026-07-31"),
];

const tasks: Task[] = [
  {
    id: 1,
    deal_id: 1,
    due_date: "2026-07-24T09:00:00.000Z",
    done_date: null,
    sales_id: 0,
    source: "trello",
    text: "Mohammed Nadi bellen en opdracht inventariseren",
    trello_checkitem_id: "check-1",
    type: "call",
  },
  {
    id: 2,
    deal_id: 3,
    due_date: "2026-07-23T09:00:00.000Z",
    done_date: null,
    sales_id: 0,
    source: "trello",
    text: "Desktop en mobiel testen",
    trello_checkitem_id: "check-2",
    type: "ship",
  },
];

const run: IntegrationRun = {
  id: 1,
  integration: "trello",
  run_kind: "backfill",
  status: "success",
  started_at: "2026-07-21T21:02:31.000Z",
  finished_at: "2026-07-21T21:03:04.000Z",
  duration_ms: 33_000,
  items_processed: 49,
  failed_count: 0,
  summary: {
    cardCount: 53,
    synced: 49,
    ignored: 4,
    stageCounts: {
      "informatie-pipeline": 9,
      "bevestigd-inplannen": 2,
      "on-hold": 13,
      bezig: 1,
      "controle-livegang": 4,
      "facturatie-live": 1,
      won: 12,
      maandelijks: 7,
    },
  },
  error: null,
};

export const Desktop = () => (
  <StoryWrapper
    data={{ deals, integration_runs: [run], tasks }}
    i18nProvider={i18nProvider}
  >
    <div className="min-h-screen bg-background p-6">
      <DashboardWorkspace hasDeals />
    </div>
  </StoryWrapper>
);

export const Mobile = () => <Desktop />;
Mobile.globals = {
  viewport: { value: "mobile1", isRotated: false },
};
