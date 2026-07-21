import type { Deal } from "../types";
import { buildRevenueModel, MONTHS_BACK, MONTHS_FORWARD } from "./revenueModel";

// A fixed "now" in the middle of a month/year so month-window logic is stable.
const NOW = new Date(2026, 5, 15); // 15 June 2026

let nextId = 1;
const makeDeal = (overrides: Partial<Deal>): Deal =>
  ({
    id: nextId++,
    name: "Test deal",
    company_id: 1,
    contact_ids: [],
    category: null,
    stage: "bezig",
    description: null,
    amount: 1000,
    created_at: "2026-01-10T10:00:00.000Z",
    updated_at: "2026-01-10T10:00:00.000Z",
    expected_closing_date: "2026-06-20",
    sales_id: 1,
    index: 0,
    ...overrides,
  }) as Deal;

const currentMonthBucket = (model: ReturnType<typeof buildRevenueModel>) =>
  model.months[MONTHS_BACK - 1];

describe("buildRevenueModel", () => {
  describe("MRR (realized recurring)", () => {
    it("counts only permanent monthly-client cards as MRR", () => {
      const deals = [
        makeDeal({
          revenue_period: "maandelijks",
          stage: "facturatie-live",
          amount: 300,
          moneybird_invoice_id: "invoice-1",
          moneybird_invoice_status: "completed",
        }),
        makeDeal({ revenue_period: "maandelijks", stage: "won", amount: 200 }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "maandelijks",
          amount: 150,
        }),
        // Open recurring deals (not yet won/live) must NOT count as MRR.
        makeDeal({
          revenue_period: "maandelijks",
          stage: "informatie-pipeline",
          amount: 999,
        }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "bezig",
          amount: 999,
        }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "on-hold",
          amount: 999,
        }),
      ];
      expect(buildRevenueModel(deals, NOW).mrr).toBe(150);
    });

    it("excludes open recurring deals from the realized bars", () => {
      const deals = [
        makeDeal({
          revenue_period: "maandelijks",
          stage: "maandelijks",
          amount: 300,
        }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "bezig",
          amount: 999,
        }),
      ];
      const model = buildRevenueModel(deals, NOW);
      expect(currentMonthBucket(model).recurring).toBe(300);
    });
  });

  describe("one-off revenue", () => {
    it("only counts won one-off deals for the realized numbers", () => {
      const deals = [
        makeDeal({
          revenue_period: "eenmalig",
          stage: "won",
          amount: 1500,
          delivery_date: "2026-06-05",
        }),
        makeDeal({ revenue_period: "eenmalig", stage: "bezig", amount: 999 }),
      ];
      const model = buildRevenueModel(deals, NOW);
      expect(model.oneOffThisYear).toBe(1500);
      expect(currentMonthBucket(model).oneoff).toBe(1500);
    });

    it("treats a won deal without a revenue_period as one-off", () => {
      const deals = [
        makeDeal({
          revenue_period: null,
          stage: "won",
          amount: 800,
          delivery_date: "2026-06-05",
        }),
      ];
      const model = buildRevenueModel(deals, NOW);
      expect(model.oneOffThisYear).toBe(800);
      expect(currentMonthBucket(model).oneoff).toBe(800);
      expect(model.openPipeline).toBe(0);
    });
  });

  describe("forecast (tile + bars consistency)", () => {
    it("weights the whole open pipeline: one-off, recurring and typeless deals", () => {
      const deals = [
        // 1000 * 0.6 (bezig)
        makeDeal({ revenue_period: "eenmalig", stage: "bezig", amount: 1000 }),
        // Open recurring belongs to the forecast: 400 * 0.15
        makeDeal({
          revenue_period: "maandelijks",
          stage: "informatie-pipeline",
          amount: 400,
        }),
        // Paused work is deliberately excluded from the forecast.
        makeDeal({ revenue_period: null, stage: "on-hold", amount: 600 }),
        // Facturatie/live without an actual Moneybird invoice is still backlog.
        makeDeal({
          revenue_period: "maandelijks",
          stage: "facturatie-live",
          amount: 999,
        }),
        // Won deals are realized, not open pipeline.
        makeDeal({ revenue_period: "eenmalig", stage: "won", amount: 999 }),
      ];
      const model = buildRevenueModel(deals, NOW);
      expect(model.openPipeline).toBe(
        Math.round(1000 * 0.6 + 400 * 0.15 + 999 * 0.95),
      );
    });

    it("distributes the same population over the forecast bars: bars sum to tile + projected MRR", () => {
      const deals = [
        makeDeal({
          revenue_period: "maandelijks",
          stage: "maandelijks",
          amount: 250,
        }),
        makeDeal({
          revenue_period: "eenmalig",
          stage: "bezig",
          amount: 1000,
          expected_closing_date: "2026-07-10",
        }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "informatie-pipeline",
          amount: 500,
          expected_closing_date: "2026-08-10",
        }),
        // Paused deals do not pollute the forecast.
        makeDeal({
          revenue_period: null,
          stage: "on-hold",
          amount: 200,
          expected_closing_date: "2026-01-10",
        }),
        // Expected beyond the window: clamped into the last forecast month.
        makeDeal({
          revenue_period: "eenmalig",
          stage: "bezig",
          amount: 300,
          expected_closing_date: "2027-03-10",
        }),
      ];
      const model = buildRevenueModel(deals, NOW);
      const prognoseTotal = model.months.reduce(
        (sum, m) => sum + m.prognose,
        0,
      );
      expect(prognoseTotal).toBe(
        model.openPipeline + MONTHS_FORWARD * model.mrr,
      );
    });

    it("shows no forecast in past months", () => {
      const deals = [
        makeDeal({ revenue_period: "eenmalig", stage: "bezig", amount: 1000 }),
      ];
      const model = buildRevenueModel(deals, NOW);
      const pastMonths = model.months.slice(0, MONTHS_BACK - 1);
      expect(pastMonths.every((m) => m.prognose === 0)).toBe(true);
    });

    it("keeps deals without a closing date out of month bars", () => {
      const model = buildRevenueModel(
        [
          makeDeal({
            amount: 2000,
            expected_closing_date: null,
            stage: "bezig",
          }),
        ],
        NOW,
      );

      expect(model.openPipeline).toBe(0);
      expect(model.unplannedPipeline).toBe(1200);
      expect(model.unplannedDealCount).toBe(1);
      expect(model.months.every((month) => month.prognose === 0)).toBe(true);
    });
  });

  describe("filtering", () => {
    it("ignores archived, lost and amountless deals", () => {
      const deals = [
        makeDeal({
          revenue_period: "maandelijks",
          stage: "facturatie-live",
          amount: 100,
          archived_at: "2026-05-01T00:00:00.000Z",
        }),
        makeDeal({ revenue_period: "maandelijks", stage: "lost", amount: 100 }),
        makeDeal({
          revenue_period: "maandelijks",
          stage: "facturatie-live",
          amount: null,
        }),
      ];
      const model = buildRevenueModel(deals, NOW);
      expect(model.mrr).toBe(0);
      expect(model.openPipeline).toBe(0);
      expect(model.oneOffThisYear).toBe(0);
    });
  });
});
