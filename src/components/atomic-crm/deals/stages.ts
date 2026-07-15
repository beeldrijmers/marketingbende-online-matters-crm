import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";

export type DealsByStage = Record<Deal["stage"], Deal[]>;

export const getDealsByStage = (
  unorderedDeals: Deal[],
  dealStages: ConfigurationContextValue["dealStages"],
  preserveInputOrder = false,
) => {
  if (!dealStages) return {};
  const dealsByStage: Record<Deal["stage"], Deal[]> = unorderedDeals.reduce(
    (acc, deal) => {
      // if deal has a stage that does not exist in configuration, assign it to the first stage
      const stage = dealStages.find((s) => s.value === deal.stage)
        ? deal.stage
        : dealStages[0].value;
      acc[stage].push(deal);
      return acc;
    },
    dealStages.reduce(
      (obj, stage) => ({ ...obj, [stage.value]: [] }),
      {} as Record<Deal["stage"], Deal[]>,
    ),
  );
  if (!preserveInputOrder) {
    // The regular pipeline follows its manually managed position. Specialized
    // boards can preserve a pre-ranked input order instead.
    dealStages.forEach((stage) => {
      dealsByStage[stage.value] = dealsByStage[stage.value].sort(
        (recordA: Deal, recordB: Deal) => recordA.index - recordB.index,
      );
    });
  }
  return dealsByStage;
};
