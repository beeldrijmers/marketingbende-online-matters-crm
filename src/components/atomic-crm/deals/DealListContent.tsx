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
import { persistDealStageMove, updateDealStageLocal } from "./dealStageMove";
import { DealColumn } from "./DealColumn";
import { buildOpenTasksByDeal, rankDealsForAttention } from "./dealWorkflow";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";

export const DealListContent = ({
  attentionPipeline = false,
  detailBasePath,
  embedded = false,
  onDealStageChange,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  detailBasePath?: string;
  embedded?: boolean;
  onDealStageChange?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
} = {}) => {
  const { dealStages } = useConfigurationContext();
  const {
    data: unorderedDeals,
    filterValues,
    isPending,
    refetch,
  } = useListContext<Deal>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { data: tasks = [] } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "due_date", order: "ASC" },
    filter: {},
  });
  const tasksByDeal = useMemo(() => buildOpenTasksByDeal(tasks), [tasks]);
  const visibleDealStages = useMemo(
    () =>
      filterValues?.["stage@neq"] === "won"
        ? dealStages.filter((stage) => stage.value !== "won")
        : dealStages,
    [dealStages, filterValues],
  );

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(() =>
    getDealsByStage([], visibleDealStages),
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
        visibleDealStages,
        attentionPipeline,
      );
      setDealsByStage((currentDealsByStage) =>
        isEqual(newDealsByStage, currentDealsByStage)
          ? currentDealsByStage
          : newDealsByStage,
      );
    }
  }, [attentionPipeline, tasksByDeal, unorderedDeals, visibleDealStages]);

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
    persistDealStageMove(sourceDeal, destinationDeal, dataProvider)
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

  const moveDealToStage = (deal: Deal, destinationStage: string) => {
    if (deal.stage === destinationStage) return;
    const sourceIndex = dealsByStage[deal.stage]?.findIndex(
      (candidate) => candidate.id === deal.id,
    );
    if (sourceIndex == null || sourceIndex < 0) return;

    setDealsByStage((current) => {
      const currentSourceIndex = current[deal.stage]?.findIndex(
        (candidate) => candidate.id === deal.id,
      );
      if (currentSourceIndex == null || currentSourceIndex < 0) return current;
      return updateDealStageLocal(
        deal,
        { stage: deal.stage, index: currentSourceIndex },
        {
          stage: destinationStage,
          index: current[destinationStage]?.length ?? 0,
        },
        current,
      );
    });

    persistDealStageMove(
      deal,
      { stage: destinationStage, index: undefined },
      dataProvider,
    )
      .then(() => {
        onDealStageChange?.(deal, destinationStage);
        refetch();
      })
      .catch((error) => {
        console.error("Failed to persist the quick deal move:", error);
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
          embedded
            ? attentionPipeline
              ? "h-[calc(100svh-31rem)] min-h-[30rem] overflow-x-auto overscroll-contain pb-2"
              : "h-[calc(100svh-22rem)] min-h-[34rem] overflow-x-auto overscroll-contain pb-2"
            : attentionPipeline
              ? "h-[calc(100dvh-23rem)] min-h-96 overflow-x-auto overscroll-contain pb-2"
              : "h-[calc(100dvh-11rem)] min-h-80 overflow-x-auto overscroll-contain pb-2"
        }
      >
        <div className="flex h-full gap-4">
          {visibleDealStages.map((stage) => (
            <DealColumn
              attentionPipeline={attentionPipeline}
              detailBasePath={detailBasePath}
              stage={stage.value}
              // A filter toggle can reveal a column one render before the
              // grouped state effect has populated its key. Render it empty
              // during that transition instead of crashing DealColumn.
              deals={dealsByStage[stage.value] ?? []}
              tasksByDeal={tasksByDeal}
              onMoveToStage={attentionPipeline ? moveDealToStage : undefined}
              onPlanTask={onPlanTask}
              key={stage.value}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
};
