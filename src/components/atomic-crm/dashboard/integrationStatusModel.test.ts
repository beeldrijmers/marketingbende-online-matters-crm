import { describe, expect, it } from "vitest";

import type { IntegrationRun } from "../types";
import { getIntegrationHealth } from "./integrationStatusModel";

const run = (overrides: Partial<IntegrationRun> = {}): IntegrationRun => ({
  id: 1,
  integration: "trello",
  run_kind: "manual",
  status: "success",
  started_at: "2026-07-14T10:00:00.000Z",
  finished_at: "2026-07-14T10:01:00.000Z",
  duration_ms: 60_000,
  items_processed: 46,
  failed_count: 0,
  summary: {},
  error: null,
  ...overrides,
});

describe("getIntegrationHealth", () => {
  it("reports a clean successful run", () => {
    expect(getIntegrationHealth(run())).toMatchObject({
      label: "Bijgewerkt",
      tone: "success",
    });
  });

  it("calls out partial runs with their failure count", () => {
    expect(
      getIntegrationHealth(run({ status: "partial", failed_count: 2 })),
    ).toEqual({
      label: "Aandacht nodig",
      description: "2 kaarten niet verwerkt.",
      tone: "warning",
    });
  });

  it("recognizes a run that has been stuck for more than ten minutes", () => {
    expect(
      getIntegrationHealth(
        run({ status: "running", finished_at: null }),
        new Date("2026-07-14T10:11:00.000Z").getTime(),
      ).tone,
    ).toBe("warning");
  });

  it("uses Gmail-specific wording for mailbox runs", () => {
    expect(
      getIntegrationHealth(run({ integration: "gmail", items_processed: 12 }))
        .description,
    ).toBe("12 berichten verwerkt zonder fouten.");
  });

  it("noemt de maandrapportage bij naam in plaats van Trello", () => {
    expect(
      getIntegrationHealth(run({ integration: "inzyte", items_processed: 6 }))
        .description,
    ).toBe("6 rapportages verwerkt zonder fouten.");
    expect(
      getIntegrationHealth(run({ integration: "inzyte", status: "failed" }))
        .description,
    ).toBe("De maandrapportage is niet volledig bijgewerkt.");
  });

  it("houdt enkelvoud enkelvoud, ook bij een geslaagde run", () => {
    expect(
      getIntegrationHealth(run({ integration: "inzyte", items_processed: 1 }))
        .description,
    ).toBe("1 rapportage verwerkt zonder fouten.");
  });
});
