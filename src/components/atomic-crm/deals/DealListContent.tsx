import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import type { Deal, Task } from "../types";
import { DealColumn } from "./DealColumn";
import { buildOpenTasksByDeal, rankDealsForAttention } from "./dealWorkflow";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";
import { writeLinkedDealStageToTrello } from "./trelloStageWriteback";

export const DealListContent = ({
  attentionPipeline = false,
  detailBasePath,
  onDealStageChange,
}: {
  attentionPipeline?: boolean;
  detailBasePath?: string;
  onDealStageChange?: (deal: Deal, destinationStage: string) => void;
} = {}) => {
  const { dealStages } = useConfigurationContext();
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { data: tasks = [] } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "due_date", order: "ASC" },
    filter: {},
  });
  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(
    getDealsByStage([], dealStages),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const orderedDeals = attentionPipeline
        ? rankDealsForAttention(unorderedDeals, tasksByDeal).map(
            ({ deal }) => deal,
          )
        : unorderedDeals;
      const newDealsByStage = getDealsByStage(
        orderedDeals,
        dealStages,
        attentionPipeline,
      );
      setDealsByStage((currentDealsByStage) =>
        isEqual(newDealsByStage, currentDealsByStage)
          ? currentDealsByStage
          : newDealsByStage,
      );
    }
  }, [attentionPipeline, dealStages, tasksByDeal, unorderedDeals]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;
    const sourceDeal = dealsByStage[sourceStage][source.index]!;
    const destinationDeal = dealsByStage[destinationStage][
      destination.index
    ] ?? {
      stage: destinationStage,
      index: undefined, // undefined if dropped after the last item
    };

    // compute local state change synchronously
    setDealsByStage(
      updateDealStageLocal(
        sourceDeal,
        { stage: sourceStage, index: source.index },
        { stage: destinationStage, index: destination.index },
        dealsByStage,
      ),
    );

    // persist the changes
    updateDealStage(sourceDeal, destinationDeal, dataProvider)
      .then(() => {
        if (sourceStage !== destinationStage) {
          onDealStageChange?.(sourceDeal, destinationStage);
        }
        refetch();
      })
      .catch((error) => {
        // The optimistic local move failed to persist: tell the user and
        // refetch so the board snaps back to the server state instead of
        // silently showing unsaved positions.
        console.error("Failed to persist the deal move:", error);
        notify(
          error instanceof Error ? error.message : "resources.deals.move_error",
          { type: "error" },
        );
        refetch();
      });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        className={
          attentionPipeline
            ? "h-[calc(100dvh-19rem)] min-h-96 overflow-x-auto overscroll-contain pb-2"
            : "h-[calc(100dvh-11rem)] min-h-80 overflow-x-auto overscroll-contain pb-2"
        }
      >
        <div className="flex h-full gap-4">
          {dealStages.map((stage) => (
            <DealColumn
              attentionPipeline={attentionPipeline}
              detailBasePath={detailBasePath}
              stage={stage.value}
              deals={dealsByStage[stage.value]}
              tasksByDeal={tasksByDeal}
              key={stage.value}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
};

const updateDealStageLocal = (
  sourceDeal: Deal,
  source: { stage: string; index: number },
  destination: {
    stage: string;
    index?: number; // undefined if dropped after the last item
  },
  dealsByStage: DealsByStage,
) => {
  if (source.stage === destination.stage) {
    // moving deal inside the same column
    const column = dealsByStage[source.stage];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceDeal);
    return {
      ...dealsByStage,
      [destination.stage]: column,
    };
  } else {
    // moving deal across columns
    const sourceColumn = dealsByStage[source.stage];
    const destinationColumn = dealsByStage[destination.stage];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceDeal,
    );
    return {
      ...dealsByStage,
      [source.stage]: sourceColumn,
      [destination.stage]: destinationColumn,
    };
  }
};

type DealBoardDataProvider = Pick<
  CrmDataProvider,
  "getList" | "update" | "moveTrelloDealToStage"
>;

const updateDealStage = async (
  source: Deal,
  destination: {
    stage: string;
    index?: number; // undefined if dropped after the last item
  },
  dataProvider: DealBoardDataProvider,
) => {
  if (source.stage === destination.stage) {
    // moving deal inside the same column
    // Fetch all the deals in this stage (because the list may be filtered, but we need to update even non-filtered deals)
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      // Match the board's perPage so columns beyond 100 deals reindex fully.
      pagination: { page: 1, perPage: 1000 },
      filter: { stage: source.stage },
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;

    if (source.index > destinationIndex) {
      // deal moved up, eg
      // dest   src
      //  <------
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between destinationIndex and source.index, increase the index
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
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    } else {
      // deal moved down, e.g
      // src   dest
      //  ------>
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between source.index and destinationIndex, decrease the index
        ...columnDeals
          .filter(
            (deal) =>
              deal.index <= destinationIndex && deal.index > source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index - 1 },
              previousData: deal,
            }),
          ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    }
  } else {
    // moving deal across columns
    // Trello is the upstream source for linked cards. Move it first so a
    // failed Trello write never leaves the CRM in a stage that the next pull
    // would immediately overwrite. Unlinked CRM-only deals skip this call.
    await writeLinkedDealStageToTrello(source, destination.stage, dataProvider);

    // Fetch all the deals in both stages (because the list may be filtered, but we need to update even non-filtered deals)
    const [{ data: sourceDeals }, { data: destinationDeals }] =
      await Promise.all([
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
      ]);
    const destinationIndex = destination.index ?? destinationDeals.length + 1;

    await Promise.all([
      // decrease index on the deals after the source index in the source columns
      ...sourceDeals
        .filter((deal) => deal.index > source.index)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index - 1 },
            previousData: deal,
          }),
        ),
      // increase index on the deals after the destination index in the destination columns
      ...destinationDeals
        .filter((deal) => deal.index >= destinationIndex)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index + 1 },
            previousData: deal,
          }),
        ),
      // change the dragged deal to take the destination index and column
      dataProvider.update("deals", {
        id: source.id,
        data: {
          index: destinationIndex,
          stage: destination.stage,
        },
        previousData: source,
      }),
    ]);
  }
};
