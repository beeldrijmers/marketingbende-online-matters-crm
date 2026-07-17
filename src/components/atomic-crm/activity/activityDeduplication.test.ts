import { describe, expect, it } from "vitest";

import { CONTACT_NOTE_CREATED, DEAL_NOTE_CREATED } from "../consts";
import type { Activity } from "../types";
import { dedupeActivitiesBySourceEvent } from "./activityDeduplication";

const contactNote = (id: number, sourceEventId?: string): Activity =>
  ({
    id: `contactNote.${id}.created`,
    type: CONTACT_NOTE_CREATED,
    date: `2026-07-17T08:57:0${id}Z`,
    contactNote: {
      id,
      contact_id: id,
      text: "Hetzelfde bericht",
      date: `2026-07-17T08:57:0${id}Z`,
      sales_id: 1,
      status: "",
      source_event_id: sourceEventId,
    },
  }) as Activity;

const dealNote = (id: number, sourceEventId: string): Activity =>
  ({
    id: `dealNote.${id}.created`,
    type: DEAL_NOTE_CREATED,
    date: `2026-07-17T08:57:0${id}Z`,
    dealNote: {
      id,
      deal_id: id,
      text: "Hetzelfde bericht",
      date: `2026-07-17T08:57:0${id}Z`,
      sales_id: 1,
      source_event_id: sourceEventId,
    },
  }) as Activity;

describe("dedupeActivitiesBySourceEvent", () => {
  it("shows one global activity when one mail is linked to several entities", () => {
    const first = contactNote(1, "gmail:7:message-1");
    const second = contactNote(2, "gmail:7:message-1");
    const mirroredDeal = dealNote(3, "gmail:7:message-1");

    expect(
      dedupeActivitiesBySourceEvent([first, second, mirroredDeal]),
    ).toEqual([first]);
  });

  it("keeps identical manual notes because it never guesses without a source id", () => {
    const first = contactNote(1);
    const second = contactNote(2);

    expect(dedupeActivitiesBySourceEvent([first, second])).toEqual([
      first,
      second,
    ]);
  });
});
