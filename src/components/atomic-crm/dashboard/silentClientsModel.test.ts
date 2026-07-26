import type { Deal } from "../types";
import { selectSilentClients } from "./silentClientsModel";

const now = new Date("2026-07-26T09:00:00.000Z");

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    amount: 1_000,
    category: "seo",
    client_updated_at: null,
    company_id: 1,
    contact_ids: [],
    created_at: "2026-07-01T09:00:00.000Z",
    description: null,
    expected_closing_date: null,
    id: 1,
    index: 0,
    name: "Staging klaar",
    sales_id: 1,
    stage: "bezig",
    updated_at: "2026-07-12T09:00:00.000Z",
    ...overrides,
  }) as Deal;

describe("selectSilentClients", () => {
  it("puts work the client was never told about first", () => {
    const rows = selectSilentClients(
      [
        deal({ id: 1, client_updated_at: "2026-06-01T09:00:00.000Z" }),
        deal({ id: 2, client_updated_at: null }),
      ],
      now,
    );

    expect(rows.map((row) => row.dealId)).toEqual([2, 1]);
    expect(rows[0].daysSilent).toBeNull();
    expect(rows[1].daysSilent).toBe(55);
  });

  it("leaves recently updated work alone", () => {
    const rows = selectSilentClients(
      [deal({ id: 1, client_updated_at: "2026-07-20T09:00:00.000Z" })],
      now,
    );

    expect(rows).toHaveLength(0);
  });

  it("does not ask for an update on work that is finished or archived", () => {
    const rows = selectSilentClients(
      [
        deal({ id: 1, stage: "won" }),
        deal({ id: 2, stage: "lost" }),
        deal({ id: 3, archived_at: "2026-07-10T09:00:00.000Z" }),
      ],
      now,
    );

    expect(rows).toHaveLength(0);
  });

  it("sorts the longest silence first", () => {
    const rows = selectSilentClients(
      [
        deal({ id: 1, client_updated_at: "2026-07-01T09:00:00.000Z" }),
        deal({ id: 2, client_updated_at: "2026-05-01T09:00:00.000Z" }),
        deal({ id: 3, client_updated_at: "2026-07-10T09:00:00.000Z" }),
      ],
      now,
    );

    expect(rows.map((row) => row.dealId)).toEqual([2, 1, 3]);
  });

  it("treats a malformed date as never told, not as up to date", () => {
    const rows = selectSilentClients(
      [deal({ id: 1, client_updated_at: "geen datum" })],
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].daysSilent).toBeNull();
  });

  it("respects a different threshold", () => {
    const deals = [
      deal({ id: 1, client_updated_at: "2026-07-21T09:00:00.000Z" }),
    ];

    expect(selectSilentClients(deals, now, 14)).toHaveLength(0);
    expect(selectSilentClients(deals, now, 3)).toHaveLength(1);
  });
});

describe("selectSilentClients and fresh work", () => {
  it("does not ask for a progress report on work that just started", () => {
    const rows = selectSilentClients(
      [
        deal({
          id: 1,
          client_updated_at: null,
          created_at: "2026-07-24T09:00:00.000Z",
        }),
      ],
      now,
    );

    expect(rows).toHaveLength(0);
  });

  it("does ask once work has been running a while without a word", () => {
    const rows = selectSilentClients(
      [
        deal({
          id: 1,
          client_updated_at: null,
          created_at: "2026-06-01T09:00:00.000Z",
        }),
      ],
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].daysSilent).toBeNull();
  });

  it("treats an unreadable start date as long-running rather than fresh", () => {
    const rows = selectSilentClients(
      [deal({ id: 1, client_updated_at: null, created_at: "onbekend" })],
      now,
    );

    expect(rows).toHaveLength(1);
  });
});
