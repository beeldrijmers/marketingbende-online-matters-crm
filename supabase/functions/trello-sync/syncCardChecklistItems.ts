import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { TrelloCardInput } from "./trelloCardTypes.ts";
import {
  mapCheckItemsToTasks,
  resolveStepMutation,
  normalizeMemberName,
  type ExistingStep,
  type StepInsert,
} from "./stepSyncLogic.ts";

interface SalesRow {
  id: number;
  first_name: string;
  last_name: string;
}

interface ExistingTaskRow extends ExistingStep {
  trello_checkitem_id: string;
}

// Mirrors a Trello card's checklist items onto the deal's tasks ("stappen"):
// new items are inserted, completions/reopenings/renames flow in from Trello,
// and items deleted in Trello are removed. Assignee and due date are only
// filled when empty, so a CRM user can claim ("oppakken") or postpone a step
// without the next sync undoing it.
//
// Best-effort by design: any failure is logged and swallowed so the deal upsert
// (and therefore the webhook) still succeeds. Trello re-sends card events, so a
// transient miss self-heals on the next change.
export const syncCardChecklistItems = async (
  card: TrelloCardInput,
  dealId: number,
): Promise<void> => {
  try {
    const salesByName = await loadSalesByName();
    const desired = mapCheckItemsToTasks(card, salesByName);
    const desiredIds = new Set(desired.map((step) => step.trelloCheckItemId));

    const existingByCheckItemId = await loadExistingSteps(dealId);
    const nowIso = new Date().toISOString();

    const inserts: StepInsert[] = [];
    for (const step of desired) {
      const mutation = resolveStepMutation(
        dealId,
        step,
        existingByCheckItemId.get(step.trelloCheckItemId),
        nowIso,
      );
      if (mutation.kind === "insert") {
        inserts.push(mutation.row);
      } else if (mutation.kind === "update") {
        const { id, ...patch } = mutation.patch;
        const { error } = await supabaseAdmin
          .from("tasks")
          .update(patch)
          .eq("id", id);
        if (error) {
          throw new Error(`update task ${id} failed: ${error.message}`);
        }
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabaseAdmin.from("tasks").insert(inserts);
      if (error) {
        throw new Error(`insert steps failed: ${error.message}`);
      }
    }

    // Remove steps whose checklist item no longer exists on the card.
    const removedIds = [...existingByCheckItemId.values()]
      .filter((row) => !desiredIds.has(row.trello_checkitem_id))
      .map((row) => row.id);
    if (removedIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("tasks")
        .delete()
        .in("id", removedIds);
      if (error) {
        throw new Error(`delete removed steps failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(
      `Could not sync checklist steps for deal ${dealId} (card ${card.id}):`,
      (error as Error).message,
    );
  }
};

const loadSalesByName = async (): Promise<Map<string, number>> => {
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id, first_name, last_name")
    .neq("disabled", true);
  if (error) {
    throw new Error(`could not load sales users: ${error.message}`);
  }
  const map = new Map<string, number>();
  for (const sale of (data ?? []) as SalesRow[]) {
    const fullName = `${sale.first_name} ${sale.last_name}`;
    map.set(normalizeMemberName(fullName), sale.id);
  }
  return map;
};

const loadExistingSteps = async (
  dealId: number,
): Promise<Map<string, ExistingTaskRow>> => {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, text, done_date, sales_id, due_date, trello_checkitem_id")
    .eq("deal_id", dealId)
    .eq("source", "trello");
  if (error) {
    throw new Error(`could not load existing steps: ${error.message}`);
  }
  const map = new Map<string, ExistingTaskRow>();
  for (const row of (data ?? []) as ExistingTaskRow[]) {
    if (row.trello_checkitem_id) {
      map.set(row.trello_checkitem_id, row);
    }
  }
  return map;
};
