import type { Contact, Deal, Task } from "../types";
import { buildOpenTasksByDeal } from "../deals/dealWorkflow";
import { rankHotLeads } from "./hotLeads";

const now = new Date(2026, 6, 14, 12);

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1_000,
  category: "seo",
  company_id: 1,
  contact_ids: [],
  created_at: "2026-07-01T09:00:00.000Z",
  description: null,
  expected_closing_date: "2026-07-31",
  id: 1,
  index: 0,
  name: "SEO-retainer",
  sales_id: 1,
  stage: "bezig",
  updated_at: "2026-07-12T09:00:00.000Z",
  ...overrides,
});

const contact = (overrides: Partial<Contact> = {}): Contact => ({
  background: "",
  company_id: 1,
  email_jsonb: [],
  first_name: "Robin",
  first_seen: "2026-07-01T09:00:00.000Z",
  gender: "",
  has_newsletter: false,
  id: 10,
  last_name: "Jansen",
  last_seen: "2026-07-12T09:00:00.000Z",
  phone_jsonb: [],
  sales_id: 1,
  status: "warm",
  tags: [],
  title: "",
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  contact_id: null,
  deal_id: 1,
  due_date: "2026-07-20",
  id: 100,
  text: "Opvolgen",
  type: "follow-up",
  ...overrides,
});

describe("rankHotLeads", () => {
  it("turns company-only deals into a lead and groups the relationship", () => {
    const leads = rankHotLeads(
      [
        deal({ id: 1, amount: 2_000 }),
        deal({ id: 2, amount: 3_000, name: "Website" }),
      ],
      new Map(),
      [],
      now,
    );

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      activeDealCount: 2,
      contact: null,
      totalAmount: 5_000,
    });
  });

  it("does not present paused, completed or internal work as a hot lead", () => {
    const leads = rankHotLeads(
      [
        deal({ id: 1, stage: "on-hold" }),
        deal({ id: 2, stage: "won" }),
        deal({ id: 3, is_internal: true }),
        deal({ id: 4, archived_at: "2026-07-14" }),
      ],
      new Map(),
      [],
      now,
    );

    expect(leads).toEqual([]);
  });

  it("uses a company contact when the imported deal has no contact link", () => {
    const hotContact = contact({ id: 11, status: "hot" });
    const warmContact = contact({ id: 12, status: "warm" });

    const [lead] = rankHotLeads(
      [deal()],
      new Map(),
      [warmContact, hotContact],
      now,
    );

    expect(lead.contact?.id).toBe(11);
  });

  it("ranks urgent follow-up above a quieter active relationship", () => {
    const tasksByDeal = buildOpenTasksByDeal([
      task({ deal_id: 2, due_date: "2026-07-14" }),
    ]);
    const leads = rankHotLeads(
      [
        deal({
          company_id: 1,
          id: 1,
          stage: "facturatie-live",
          updated_at: "2026-05-01T09:00:00.000Z",
        }),
        deal({
          company_id: 2,
          id: 2,
          stage: "informatie-pipeline",
        }),
      ],
      tasksByDeal,
      [],
      now,
    );

    expect(leads.map(({ primaryDeal }) => primaryDeal.id)).toEqual([2, 1]);
    expect(leads[0].workflow.kind).toBe("today");
  });
});
