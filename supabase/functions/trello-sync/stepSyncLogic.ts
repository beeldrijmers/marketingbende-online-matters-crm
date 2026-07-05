import type { TrelloCardInput } from "./trelloCardTypes.ts";

// A Trello checklist item, resolved to the CRM user who owns it.
export interface DesiredStep {
  trelloCheckItemId: string;
  text: string;
  complete: boolean;
  salesId: number | null;
  due: string | null;
}

// The existing `source='trello'` task row we compare a desired step against.
export interface ExistingStep {
  id: number;
  text: string | null;
  done_date: string | null;
  sales_id: number | null;
  due_date: string | null;
}

export interface StepInsert {
  deal_id: number;
  source: "trello";
  trello_checkitem_id: string;
  text: string;
  type: string;
  done_date: string | null;
  sales_id: number | null;
  due_date: string | null;
}

export interface StepUpdate {
  id: number;
  // Only the fields that actually changed are included.
  text?: string;
  done_date?: string | null;
  sales_id?: number;
  due_date?: string;
}

export type StepMutation =
  | { kind: "insert"; row: StepInsert }
  | { kind: "update"; patch: StepUpdate }
  | { kind: "noop" };

export const normalizeMemberName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

// Resolves each checklist item to the CRM user responsible for it: the item's
// own assignee when set, otherwise the card's sole member (when there is exactly
// one), otherwise nobody — those land in the shared "op te pakken" bucket.
export const mapCheckItemsToTasks = (
  card: Pick<TrelloCardInput, "members" | "checkItems">,
  salesByName: Map<string, number>,
): DesiredStep[] => {
  const memberNameById = new Map(
    card.members.map((member) => [member.id, member.fullName]),
  );
  const soleMemberName =
    card.members.length === 1 ? card.members[0].fullName : null;

  return card.checkItems.map((item) => {
    const ownerName = item.memberId
      ? (memberNameById.get(item.memberId) ?? null)
      : soleMemberName;
    const salesId =
      ownerName != null
        ? (salesByName.get(normalizeMemberName(ownerName)) ?? null)
        : null;
    return {
      trelloCheckItemId: item.id,
      text: item.name,
      complete: item.complete,
      salesId,
      due: item.due,
    };
  });
};

// Decides what to write for one step. Trello owns the step's text and its
// completion state (so completing/reopening an item in Trello flows into the
// CRM), but the CRM owns the assignee and due date once a person has touched
// them: we only ever fill those when still empty, never overwrite. This is what
// lets someone "oppakken" a shared step in the CRM without the next sync undoing
// it.
export const resolveStepMutation = (
  dealId: number,
  desired: DesiredStep,
  existing: ExistingStep | undefined,
  nowIso: string,
): StepMutation => {
  if (!existing) {
    return {
      kind: "insert",
      row: {
        deal_id: dealId,
        source: "trello",
        trello_checkitem_id: desired.trelloCheckItemId,
        text: desired.text,
        type: "none",
        done_date: desired.complete ? nowIso : null,
        sales_id: desired.salesId,
        due_date: desired.due,
      },
    };
  }

  const patch: StepUpdate = { id: existing.id };
  let changed = false;

  if (existing.text !== desired.text) {
    patch.text = desired.text;
    changed = true;
  }

  // Completion follows Trello in both directions.
  if (desired.complete && !existing.done_date) {
    patch.done_date = nowIso;
    changed = true;
  } else if (!desired.complete && existing.done_date) {
    patch.done_date = null;
    changed = true;
  }

  // Assignee/due: fill only when empty, never clobber a CRM edit.
  if (existing.sales_id == null && desired.salesId != null) {
    patch.sales_id = desired.salesId;
    changed = true;
  }
  if (existing.due_date == null && desired.due != null) {
    patch.due_date = desired.due;
    changed = true;
  }

  return changed ? { kind: "update", patch } : { kind: "noop" };
};
