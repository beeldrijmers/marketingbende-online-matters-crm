import type { Deal } from "../types";
import { selectUpdateMoments } from "./updateMomentsModel";

// Mid-month: outside the closing window, so a missing monthly update is overdue
// for the month that already ended.
const midJuly = new Date("2026-07-15T09:00:00.000Z");
// Inside the closing window: the update being prepared covers July itself.
const endOfJuly = new Date("2026-07-29T09:00:00.000Z");

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    amount: 1_000,
    category: "eenmalig",
    client_updated_at: null,
    company_id: 1,
    contact_ids: [],
    created_at: "2026-05-01T09:00:00.000Z",
    description: null,
    expected_closing_date: null,
    id: 1,
    index: 0,
    name: "Website",
    revenue_period: "eenmalig",
    sales_id: 1,
    stage: "bezig",
    updated_at: "2026-07-10T09:00:00.000Z",
    ...overrides,
  }) as Deal;

describe("selectUpdateMoments", () => {
  it("says nothing about work that is simply in progress", () => {
    const moments = selectUpdateMoments(
      [
        deal({ id: 1, stage: "bezig" }),
        deal({ id: 2, stage: "on-hold" }),
        deal({ id: 3, stage: "informatie-pipeline" }),
      ],
      midJuly,
    );

    expect(moments).toHaveLength(0);
  });

  it("flags a finished project the client has not been told about", () => {
    const moments = selectUpdateMoments(
      [
        deal({ id: 1, stage: "facturatie-live" }),
        deal({ id: 2, stage: "won" }),
      ],
      midJuly,
    );

    expect(moments.map((moment) => moment.reason)).toEqual([
      "project_klaar",
      "project_afgerond",
    ]);
    expect(moments[0].daysWaiting).toBe(5);
  });

  it("uses the moment the work reached Klaar, not the last edit", () => {
    const moments = selectUpdateMoments(
      [
        deal({
          id: 1,
          stage: "facturatie-live",
          won_notified_at: "2026-07-01T09:00:00.000Z",
          updated_at: "2026-07-14T09:00:00.000Z",
        }),
      ],
      midJuly,
    );

    expect(moments[0].daysWaiting).toBe(14);
  });

  it("stops asking once the client heard about the finished work", () => {
    const moments = selectUpdateMoments(
      [
        deal({
          id: 1,
          stage: "facturatie-live",
          won_notified_at: "2026-07-01T09:00:00.000Z",
          client_updated_at: "2026-07-02T09:00:00.000Z",
        }),
      ],
      midJuly,
    );

    expect(moments).toHaveLength(0);
  });

  it("asks again when the work finished after the last update", () => {
    const moments = selectUpdateMoments(
      [
        deal({
          id: 1,
          stage: "won",
          client_updated_at: "2026-06-20T09:00:00.000Z",
          won_notified_at: "2026-07-05T09:00:00.000Z",
        }),
      ],
      midJuly,
    );

    expect(moments).toHaveLength(1);
    expect(moments[0].reason).toBe("project_afgerond");
  });

  it("reports the month that ended when the close was missed", () => {
    const moments = selectUpdateMoments(
      [deal({ id: 1, revenue_period: "maandelijks", stage: "maandelijks" })],
      midJuly,
    );

    expect(moments).toHaveLength(1);
    expect(moments[0].reason).toBe("maandafsluiting");
    expect(moments[0].monthLabel).toBe("juni");
  });

  it("reports the running month once the close is in sight", () => {
    const moments = selectUpdateMoments(
      [deal({ id: 1, revenue_period: "maandelijks", stage: "maandelijks" })],
      endOfJuly,
    );

    expect(moments[0].monthLabel).toBe("juli");
    expect(moments[0].daysWaiting).toBe(0);
  });

  it("counts a monthly update as done for the month it was sent in", () => {
    const deals = [
      deal({
        id: 1,
        revenue_period: "maandelijks",
        stage: "maandelijks",
        client_updated_at: "2026-07-03T09:00:00.000Z",
      }),
    ];

    expect(selectUpdateMoments(deals, midJuly)).toHaveLength(0);
    // A new month, so the previous one has to be reported again.
    expect(
      selectUpdateMoments(deals, new Date("2026-08-04T09:00:00.000Z")),
    ).toHaveLength(1);
  });

  it("treats recurring work as a monthly cycle, never as a delivered project", () => {
    const moments = selectUpdateMoments(
      [
        deal({
          id: 1,
          revenue_period: "maandelijks",
          stage: "facturatie-live",
          client_updated_at: "2026-07-05T09:00:00.000Z",
        }),
      ],
      midJuly,
    );

    expect(moments).toHaveLength(0);
  });

  it("leaves archived work out of it", () => {
    const moments = selectUpdateMoments(
      [deal({ id: 1, stage: "won", archived_at: "2026-07-01T09:00:00.000Z" })],
      midJuly,
    );

    expect(moments).toHaveLength(0);
  });

  it("puts finished work above the monthly round, longest wait first", () => {
    const moments = selectUpdateMoments(
      [
        deal({ id: 1, revenue_period: "maandelijks", stage: "maandelijks" }),
        deal({
          id: 2,
          stage: "won",
          won_notified_at: "2026-07-13T09:00:00.000Z",
        }),
        deal({
          id: 3,
          stage: "won",
          won_notified_at: "2026-07-02T09:00:00.000Z",
        }),
      ],
      midJuly,
    );

    expect(moments.map((moment) => moment.dealId)).toEqual([3, 2, 1]);
  });
});
