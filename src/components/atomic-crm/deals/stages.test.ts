import type { Deal, DealStage } from "../types";
import { getDealsByStage } from "./stages";

const stages: DealStage[] = [
  { label: "Nieuw", value: "nieuw" },
  { label: "Bezig", value: "bezig" },
];

const deal = (id: number, index: number): Deal =>
  ({ id, index, stage: "bezig" }) as Deal;

describe("deal stage grouping", () => {
  it("sorts the regular pipeline by its persisted position", () => {
    const grouped = getDealsByStage([deal(1, 20), deal(2, 10)], stages);

    expect(grouped.bezig.map(({ id }) => id)).toEqual([2, 1]);
  });

  it("preserves the urgency order supplied by a specialized pipeline", () => {
    const grouped = getDealsByStage([deal(1, 20), deal(2, 10)], stages, true);

    expect(grouped.bezig.map(({ id }) => id)).toEqual([1, 2]);
  });
});
