import type { Identifier } from "ra-core";

import type { Contact, Deal, Task } from "../types";
import { getDealWorkflow, type DealWorkflow } from "../deals/dealWorkflow";

export type HotLead = {
  activeDealCount: number;
  contact: Contact | null;
  deals: Deal[];
  primaryDeal: Deal;
  score: number;
  totalAmount: number;
  workflow: DealWorkflow;
};

type ScoredDeal = {
  contact: Contact | null;
  deal: Deal;
  score: number;
  workflow: DealWorkflow;
};

const stageScore: Record<string, number> = {
  bezig: 45,
  "informatie-pipeline": 30,
  "facturatie-live": 25,
};

const workflowScore: Record<DealWorkflow["kind"], number> = {
  complete: 0,
  missing: 5,
  on_hold: 0,
  overdue: 25,
  overdue_closing: 20,
  scheduled: 15,
  today: 30,
  unscheduled: 5,
};

const contactStatusScore: Record<string, number> = {
  cold: 0,
  hot: 30,
  "in-contract": 15,
  warm: 10,
};

const amountScore = (amount: number | null): number => {
  if (!amount || amount <= 0) return 0;
  if (amount >= 10_000) return 20;
  if (amount >= 5_000) return 15;
  if (amount >= 1_000) return 10;
  return 5;
};

const recentActivityScore = (updatedAt: string, now: Date): number => {
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return 0;
  const ageInDays = Math.max(
    0,
    (now.getTime() - updated.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (ageInDays <= 7) return 15;
  if (ageInDays <= 30) return 8;
  return 0;
};

const compareContacts = (left: Contact, right: Contact): number =>
  (contactStatusScore[right.status] ?? 0) -
  (contactStatusScore[left.status] ?? 0);

const isActiveClientDeal = (deal: Deal): boolean =>
  !deal.archived_at &&
  !deal.is_internal &&
  !deal.on_hold &&
  !["won", "lost", "on-hold"].includes(deal.stage);

export const rankHotLeads = (
  deals: Deal[],
  tasksByDeal: Map<Identifier, Task[]>,
  contacts: Contact[],
  now: Date = new Date(),
): HotLead[] => {
  const contactsById = new Map(
    contacts.map((contact) => [String(contact.id), contact]),
  );
  const contactsByCompany = new Map<string, Contact[]>();

  for (const contact of contacts) {
    if (contact.company_id == null) continue;
    const key = String(contact.company_id);
    const companyContacts = contactsByCompany.get(key);
    if (companyContacts) companyContacts.push(contact);
    else contactsByCompany.set(key, [contact]);
  }

  for (const companyContacts of contactsByCompany.values()) {
    companyContacts.sort(compareContacts);
  }

  const scoredDeals: ScoredDeal[] = deals
    .filter(isActiveClientDeal)
    .map((deal) => {
      const explicitlyLinkedContacts = (deal.contact_ids ?? [])
        .map((contactId) => contactsById.get(String(contactId)))
        .filter((contact): contact is Contact => contact != null)
        .sort(compareContacts);
      const contact =
        explicitlyLinkedContacts[0] ??
        contactsByCompany.get(String(deal.company_id))?.[0] ??
        null;
      const workflow = getDealWorkflow(
        deal,
        tasksByDeal.get(deal.id) ?? [],
        now,
      );
      const score =
        (stageScore[deal.stage] ?? 20) +
        workflowScore[workflow.kind] +
        amountScore(deal.amount) +
        recentActivityScore(deal.updated_at, now) +
        (contact ? (contactStatusScore[contact.status] ?? 0) : 0);

      return { contact, deal, score, workflow };
    });

  const groups = new Map<string, ScoredDeal[]>();
  for (const candidate of scoredDeals) {
    const groupKey =
      candidate.deal.company_id == null
        ? `deal:${candidate.deal.id}`
        : `company:${candidate.deal.company_id}`;
    const group = groups.get(groupKey);
    if (group) group.push(candidate);
    else groups.set(groupKey, [candidate]);
  }

  return Array.from(groups.values())
    .map((group): HotLead => {
      group.sort(
        (left, right) =>
          right.score - left.score ||
          new Date(right.deal.updated_at).getTime() -
            new Date(left.deal.updated_at).getTime(),
      );
      const primary = group[0];
      const contact = group.find((candidate) => candidate.contact)?.contact;
      const relationshipBonus = Math.min((group.length - 1) * 6, 18);

      return {
        activeDealCount: group.length,
        contact: contact ?? null,
        deals: group.map(({ deal }) => deal),
        primaryDeal: primary.deal,
        score: primary.score + relationshipBonus,
        totalAmount: group.reduce(
          (total, { deal }) => total + Math.max(deal.amount ?? 0, 0),
          0,
        ),
        workflow: primary.workflow,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.totalAmount - left.totalAmount ||
        new Date(right.primaryDeal.updated_at).getTime() -
          new Date(left.primaryDeal.updated_at).getTime(),
    );
};
