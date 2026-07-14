import type { CrmDataProvider } from "../providers/types";
import type { Deal } from "../types";

type TrelloStageWriter = Pick<CrmDataProvider, "moveTrelloDealToStage">;

export const writeLinkedDealStageToTrello = async (
  deal: Deal,
  destinationStage: string,
  dataProvider: TrelloStageWriter,
): Promise<void> => {
  if (!deal.trello_card_id || deal.stage === destinationStage) return;
  await dataProvider.moveTrelloDealToStage(deal.id, destinationStage);
};
