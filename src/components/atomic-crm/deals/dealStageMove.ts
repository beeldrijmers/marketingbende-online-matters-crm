import type { CrmDataProvider } from "../providers/types";
import type { Deal } from "../types";
import type { DealsByStage } from "./stages";
import { writeLinkedDealStageToTrello } from "./trelloStageWriteback";

export type DealStageDestination = {
  stage: string;
  index?: number;
};

export type DealBoardDataProvider = Pick<
  CrmDataProvider,
  "getList" | "update" | "moveTrelloDealToStage"
>;

export const updateDealStageLocal = (
  sourceDeal: Deal,
  source: { stage: string; index: number },
  destination: DealStageDestination,
  dealsByStage: DealsByStage,
) => {
  const sourceColumn = [...dealsByStage[source.stage]];
  sourceColumn.splice(source.index, 1);

  if (source.stage === destination.stage) {
    sourceColumn.splice(
      destination.index ?? sourceColumn.length,
      0,
      sourceDeal,
    );
    return { ...dealsByStage, [source.stage]: sourceColumn };
  }

  const destinationColumn = [...dealsByStage[destination.stage]];
  const movedDeal = { ...sourceDeal, stage: destination.stage };
  destinationColumn.splice(
    destination.index ?? destinationColumn.length,
    0,
    movedDeal,
  );
  return {
    ...dealsByStage,
    [source.stage]: sourceColumn,
    [destination.stage]: destinationColumn,
  };
};

export const persistDealStageMove = async (
  source: Deal,
  destination: DealStageDestination,
  dataProvider: DealBoardDataProvider,
) => {
  if (source.stage === destination.stage) {
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 1000 },
      filter: { stage: source.stage },
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;

    if (source.index > destinationIndex) {
      await Promise.all([
        ...columnDeals
          .filter(
            (deal) =>
              deal.index >= destinationIndex && deal.index < source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index + 1 },
              previousData: deal,
            }),
          ),
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
      return;
    }

    await Promise.all([
      ...columnDeals
        .filter(
          (deal) => deal.index <= destinationIndex && deal.index > source.index,
        )
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index - 1 },
            previousData: deal,
          }),
        ),
      dataProvider.update("deals", {
        id: source.id,
        data: { index: destinationIndex },
        previousData: source,
      }),
    ]);
    return;
  }

  // Trello remains upstream for linked cards. Moving it first prevents a
  // subsequent pull from immediately undoing the CRM phase change.
  await writeLinkedDealStageToTrello(source, destination.stage, dataProvider);

  const [{ data: sourceDeals }, { data: destinationDeals }] = await Promise.all(
    [
      dataProvider.getList("deals", {
        sort: { field: "index", order: "ASC" },
        pagination: { page: 1, perPage: 1000 },
        filter: { stage: source.stage },
      }),
      dataProvider.getList("deals", {
        sort: { field: "index", order: "ASC" },
        pagination: { page: 1, perPage: 1000 },
        filter: { stage: destination.stage },
      }),
    ],
  );
  const destinationIndex = destination.index ?? destinationDeals.length + 1;

  await Promise.all([
    ...sourceDeals
      .filter((deal) => deal.index > source.index)
      .map((deal) =>
        dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index - 1 },
          previousData: deal,
        }),
      ),
    ...destinationDeals
      .filter((deal) => deal.index >= destinationIndex)
      .map((deal) =>
        dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index + 1 },
          previousData: deal,
        }),
      ),
    dataProvider.update("deals", {
      id: source.id,
      data: { index: destinationIndex, stage: destination.stage },
      previousData: source,
    }),
  ]);
};
