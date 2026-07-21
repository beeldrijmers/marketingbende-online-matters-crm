import type { Deal, DealStage } from "../types";

export type TrelloBoardColumn = {
  stage: DealStage;
  deals: Deal[];
};

export type TrelloBoardSnapshot = {
  columns: TrelloBoardColumn[];
  total: number;
  unmapped: Deal[];
};

const positionedIndex = (deal: Deal): number | null =>
  Number.isFinite(deal.index) ? deal.index : null;

const compareBoardDeals = (left: Deal, right: Deal): number => {
  const leftIndex = positionedIndex(left);
  const rightIndex = positionedIndex(right);

  if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  if (leftIndex != null && rightIndex == null) return -1;
  if (leftIndex == null && rightIndex != null) return 1;

  // Imported cards created before board positioning existed can have no CRM
  // index. Keep those deterministic and operationally useful: nearest
  // deadline first, then title. No card silently disappears from a column.
  const leftDue = left.expected_closing_date ?? "9999-12-31";
  const rightDue = right.expected_closing_date ?? "9999-12-31";
  const dueOrder = leftDue.localeCompare(rightDue);
  if (dueOrder !== 0) return dueOrder;

  return left.name.localeCompare(right.name, "nl", { sensitivity: "base" });
};

/**
 * Builds the read-only dashboard mirror from active Trello-linked CRM deals.
 * Manual CRM deals and archived Trello cards are intentionally outside this
 * board: its totals must remain directly comparable with a Trello full sync.
 */
export const buildTrelloBoardSnapshot = (
  deals: Deal[],
  stages: DealStage[],
): TrelloBoardSnapshot => {
  const operationalDeals = deals.filter(
    (deal) => deal.trello_card_id != null && deal.archived_at == null,
  );
  const knownStages = new Set(stages.map((stage) => stage.value));
  const unmapped = operationalDeals
    .filter((deal) => !knownStages.has(deal.stage))
    .sort(compareBoardDeals);

  const columns = stages.map((stage) => ({
    stage,
    deals: operationalDeals
      .filter((deal) => deal.stage === stage.value)
      .sort(compareBoardDeals),
  }));

  return {
    columns,
    total: columns.reduce((total, column) => total + column.deals.length, 0),
    unmapped,
  };
};
