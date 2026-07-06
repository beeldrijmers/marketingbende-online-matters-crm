import { describe, it, expect } from "vitest";
import {
  mapCheckItemsToTasks,
  resolveStepMutation,
  normalizeMemberName,
  type DesiredStep,
  type ExistingStep,
} from "./stepSyncLogic";

const salesByName = new Map<string, number>([
  ["john plantenga", 1],
  ["rick maarssen", 2],
]);

const checkItem = (
  over: Partial<{
    id: string;
    name: string;
    complete: boolean;
    memberId: string | null;
    due: string | null;
  }> = {},
) => ({
  id: "ci1",
  name: "Logo aanleveren",
  complete: false,
  memberId: null,
  due: null,
  ...over,
});

describe("mapCheckItemsToTasks", () => {
  it("attributes every step to the card's sole member", () => {
    const result = mapCheckItemsToTasks(
      {
        members: [{ id: "m1", fullName: "Rick Maarssen" }],
        checkItems: [checkItem(), checkItem({ id: "ci2" })],
      },
      salesByName,
    );
    expect(result.map((r) => r.salesId)).toEqual([2, 2]);
  });

  it("prefers the item's own assignee over the card member", () => {
    const [step] = mapCheckItemsToTasks(
      {
        members: [
          { id: "m1", fullName: "Rick Maarssen" },
          { id: "m2", fullName: "John Plantenga" },
        ],
        checkItems: [checkItem({ memberId: "m2" })],
      },
      salesByName,
    );
    expect(step.salesId).toBe(1);
  });

  it("leaves a step unassigned when the card has several members and the item has none", () => {
    const [step] = mapCheckItemsToTasks(
      {
        members: [
          { id: "m1", fullName: "Rick Maarssen" },
          { id: "m2", fullName: "John Plantenga" },
        ],
        checkItems: [checkItem()],
      },
      salesByName,
    );
    expect(step.salesId).toBeNull();
  });

  it("leaves a step unassigned when the member has no CRM account", () => {
    const [step] = mapCheckItemsToTasks(
      {
        members: [{ id: "m1", fullName: "Iemand Anders" }],
        checkItems: [checkItem()],
      },
      salesByName,
    );
    expect(step.salesId).toBeNull();
  });

  it("carries text, completion and due through unchanged", () => {
    const [step] = mapCheckItemsToTasks(
      {
        members: [],
        checkItems: [
          checkItem({
            name: "Kleuren",
            complete: true,
            due: "2026-07-10T00:00:00.000Z",
          }),
        ],
      },
      salesByName,
    );
    expect(step).toEqual<DesiredStep>({
      trelloCheckItemId: "ci1",
      text: "Kleuren",
      complete: true,
      salesId: null,
      due: "2026-07-10T00:00:00.000Z",
    });
  });

  it("normalizes names case- and whitespace-insensitively", () => {
    expect(normalizeMemberName("  John   Plantenga ")).toBe("john plantenga");
  });
});

const NOW = "2026-07-05T20:00:00.000Z";
const desired = (over: Partial<DesiredStep> = {}): DesiredStep => ({
  trelloCheckItemId: "ci1",
  text: "Logo aanleveren",
  complete: false,
  salesId: null,
  due: null,
  ...over,
});
const existing = (over: Partial<ExistingStep> = {}): ExistingStep => ({
  id: 10,
  text: "Logo aanleveren",
  done_date: null,
  sales_id: null,
  due_date: null,
  ...over,
});

describe("resolveStepMutation", () => {
  it("inserts a new incomplete step", () => {
    const m = resolveStepMutation(7, desired({ salesId: 2 }), undefined, NOW);
    expect(m).toEqual({
      kind: "insert",
      row: {
        deal_id: 7,
        source: "trello",
        trello_checkitem_id: "ci1",
        text: "Logo aanleveren",
        type: "none",
        done_date: null,
        sales_id: 2,
        due_date: null,
      },
    });
  });

  it("inserts a completed step with done_date set to now", () => {
    const m = resolveStepMutation(
      7,
      desired({ complete: true }),
      undefined,
      NOW,
    );
    expect(m.kind).toBe("insert");
    if (m.kind === "insert") expect(m.row.done_date).toBe(NOW);
  });

  it("marks a step done when Trello completed it", () => {
    const m = resolveStepMutation(
      7,
      desired({ complete: true }),
      existing(),
      NOW,
    );
    expect(m).toEqual({ kind: "update", patch: { id: 10, done_date: NOW } });
  });

  it("reopens a step when Trello un-completed it", () => {
    const m = resolveStepMutation(
      7,
      desired({ complete: false }),
      existing({ done_date: NOW }),
      NOW,
    );
    expect(m).toEqual({ kind: "update", patch: { id: 10, done_date: null } });
  });

  it("fills the assignee when the CRM task has none", () => {
    const m = resolveStepMutation(7, desired({ salesId: 2 }), existing(), NOW);
    expect(m).toEqual({ kind: "update", patch: { id: 10, sales_id: 2 } });
  });

  it("never clobbers an assignee a CRM user already claimed", () => {
    const m = resolveStepMutation(
      7,
      desired({ salesId: 2 }),
      existing({ sales_id: 1 }),
      NOW,
    );
    expect(m).toEqual({ kind: "noop" });
  });

  it("never clobbers a due date the CRM user already set", () => {
    const m = resolveStepMutation(
      7,
      desired({ due: "2026-07-10T00:00:00.000Z" }),
      existing({ due_date: "2026-08-01T00:00:00.000Z" }),
      NOW,
    );
    expect(m).toEqual({ kind: "noop" });
  });

  it("updates the text when Trello renamed the step", () => {
    const m = resolveStepMutation(
      7,
      desired({ text: "Logo (SVG) aanleveren" }),
      existing(),
      NOW,
    );
    expect(m).toEqual({
      kind: "update",
      patch: { id: 10, text: "Logo (SVG) aanleveren" },
    });
  });

  it("does nothing when nothing changed", () => {
    expect(resolveStepMutation(7, desired(), existing(), NOW)).toEqual({
      kind: "noop",
    });
  });
});
