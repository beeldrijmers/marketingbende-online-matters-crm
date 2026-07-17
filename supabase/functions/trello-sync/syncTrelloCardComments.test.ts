import { describe, expect, it } from "vitest";
import { planTrelloCommentNoteSync } from "./trelloCommentNotePlan";

const comment = (id: string, text: string) => ({
  id,
  text,
  date: "2026-07-17T08:00:00.000Z",
  authorName: "Rick Maarssen",
});

describe("planTrelloCommentNoteSync", () => {
  it("inserts a new comment once with its stable action id", () => {
    const plan = planTrelloCommentNoteSync([comment("a1", "Start")], []);
    expect(plan.inserts).toEqual([
      {
        text: "[Trello - Rick Maarssen]\nStart",
        date: "2026-07-17T08:00:00.000Z",
        activity_source_author: "Rick Maarssen",
        source_event_id: "trello:a1",
      },
    ]);
    expect(plan.updates).toEqual([]);
  });

  it("updates an edited comment instead of duplicating it", () => {
    const plan = planTrelloCommentNoteSync(
      [comment("a1", "Nieuwe tekst")],
      [
        {
          id: 12,
          text: "[Trello - Rick Maarssen]\nOude tekst",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: "trello:a1",
        },
      ],
    );
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      expect.objectContaining({
        id: 12,
        text: "[Trello - Rick Maarssen]\nNieuwe tekst",
      }),
    ]);
  });

  it("claims an exact legacy note without creating a duplicate", () => {
    const plan = planTrelloCommentNoteSync(
      [comment("a1", "Start")],
      [
        {
          id: 7,
          text: "[Trello - Rick Maarssen]\nStart",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: null,
        },
      ],
    );
    expect(plan.inserts).toEqual([]);
    expect(plan.updates[0]).toEqual(
      expect.objectContaining({ id: 7, source_event_id: "trello:a1" }),
    );
  });

  it("keeps one exact legacy comment and removes redundant Trello copies", () => {
    const plan = planTrelloCommentNoteSync(
      [comment("a1", "Start")],
      [
        {
          id: 7,
          text: "[Trello - Rick Maarssen]\nStart",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: null,
        },
        {
          id: 8,
          text: "[Trello - Rick Maarssen]\nStart",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: null,
        },
      ],
    );
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: 7, source_event_id: "trello:a1" }),
    ]);
    expect(plan.deleteIds).toEqual([8]);
  });

  it("removes an exact legacy duplicate when a sourced comment already exists", () => {
    const plan = planTrelloCommentNoteSync(
      [comment("a1", "Start")],
      [
        {
          id: 7,
          text: "[Trello - Rick Maarssen]\nStart",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: "trello:a1",
        },
        {
          id: 8,
          text: "[Trello - Rick Maarssen]\nStart",
          date: "2026-07-17T08:00:00+00:00",
          activity_source_author: "Rick Maarssen",
          source_event_id: null,
        },
      ],
    );
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.deleteIds).toEqual([8]);
  });

  it("deletes removed comment notes but never attachment notes", () => {
    const plan = planTrelloCommentNoteSync(
      [],
      [
        {
          id: 3,
          text: "comment",
          date: null,
          activity_source_author: null,
          source_event_id: "trello:a1",
        },
        {
          id: 4,
          text: "attachment",
          date: null,
          activity_source_author: null,
          source_event_id: "trello:attachment:file1",
        },
      ],
    );
    expect(plan.deleteIds).toEqual([3]);
  });
});
