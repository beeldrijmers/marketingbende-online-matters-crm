import { Draggable } from "@hello-pangea/dnd";
import { PauseCircle, Receipt } from "lucide-react";
import { useRedirect, useTranslate, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { AssigneesField } from "../sales/AssigneesField";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { AttentionDealActions } from "./AttentionDealActions";
import { DealWorkflowIndicator } from "./DealWorkflowIndicator";
import { getDashboardDealDetailPath } from "./dashboardDealSelection";
import { getDealWorkflow } from "./dealWorkflow";
import { MoneybirdCardActions } from "./MoneybirdDocumentButtons";
import { InzyteCardActions } from "./inzyte/InzyteWorkspace";

// A monthly/recurring price hint anywhere in the card text ("EUR 300 p/m",
// "per maand", "maandelijks") means we show the amount as a monthly rate.
// The explicit revenue_period field wins; the text scan is a fallback for
// deals (e.g. imported from Trello) that never got the field set.
const RECURRING_RE = /per\s*maand|p\/m|\/\s*mnd|\bmnd\b|maandelijks/i;
const EMPTY_TASKS: Task[] = [];
const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

const formatCurrency = (amount: number, currency: string): string => {
  let formatter = CURRENCY_FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    CURRENCY_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(amount);
};

const isRecurringDeal = (deal: Deal): boolean => {
  if (deal.revenue_period) return deal.revenue_period === "maandelijks";
  return RECURRING_RE.test(`${deal.name ?? ""} ${deal.description ?? ""}`);
};

const moneybirdLabel = (deal: Deal): string | null =>
  deal.moneybird_invoice_id
    ? "Factuur"
    : deal.moneybird_estimate_id
      ? "Offerte"
      : null;

export const DealCard = ({
  attentionPipeline = false,
  deal,
  detailBasePath,
  index,
  openTasks,
  onMoveToStage,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  deal: Deal;
  detailBasePath?: string;
  index: number;
  openTasks: Task[];
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
}) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent
          attentionPipeline={attentionPipeline}
          provided={provided}
          snapshot={snapshot}
          deal={deal}
          detailBasePath={detailBasePath}
          openTasks={openTasks}
          onMoveToStage={onMoveToStage}
          onPlanTask={onPlanTask}
        />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  attentionPipeline = false,
  provided,
  snapshot,
  deal,
  detailBasePath,
  openTasks = EMPTY_TASKS,
  onMoveToStage,
  onPlanTask,
}: {
  attentionPipeline?: boolean;
  provided?: any;
  snapshot?: any;
  deal: Deal;
  detailBasePath?: string;
  openTasks?: Task[];
  onMoveToStage?: (deal: Deal, destinationStage: string) => void;
  onPlanTask?: (deal: Deal) => void;
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const translate = useTranslate();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(
      detailBasePath
        ? getDashboardDealDetailPath(detailBasePath, deal.id)
        : `/deals/${deal.id}/show`,
      undefined,
      undefined,
      undefined,
      { _scrollToTop: false },
    );
  };

  const formattedAmount = deal.amount
    ? formatCurrency(deal.amount, currency)
    : null;
  const recurring = isRecurringDeal(deal);
  const moneybird = moneybirdLabel(deal);
  const workflow = getDealWorkflow(deal, openTasks);
  const attentionAccent =
    workflow.kind === "overdue"
      ? "border-l-destructive"
      : workflow.kind === "today"
        ? "border-l-amber-500"
        : workflow.kind === "overdue_closing"
          ? "border-l-orange-500"
          : "border-l-violet-500";

  return (
    <div
      className="cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      role="link"
      tabIndex={0}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={cn(
            "py-2.5 transition-all duration-200",
            attentionPipeline &&
              "border-l-4 bg-card/95 py-3 shadow-sm hover:-translate-y-0.5",
            attentionPipeline && attentionAccent,
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md",
          )}
        >
          <CardContent className="px-3 flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm font-medium leading-snug line-clamp-2">
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                />
                {" - "}
                {deal.name}
              </p>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
            </div>

            {attentionPipeline ? (
              <DealWorkflowIndicator
                deal={deal}
                openTasks={openTasks}
                className="my-1.5 py-1.5"
                onPlanTask={onPlanTask ? () => onPlanTask(deal) : undefined}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {formattedAmount ? (
                <span className="text-sm font-bold text-foreground">
                  {formattedAmount}
                  {recurring && (
                    <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                      {translate("resources.deals.per_month_suffix")}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {translate("resources.deals.no_amount")}
                </span>
              )}
              {deal.category && (
                <Badge
                  variant="secondary"
                  className="shrink-0 px-1.5 py-0 text-[11px]"
                >
                  <SelectField
                    source="category"
                    choices={dealCategories}
                    optionText="label"
                    optionValue="value"
                    empty={deal.category}
                  />
                </Badge>
              )}
              {deal.on_hold && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 px-1.5 py-0 text-[11px] border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  <PauseCircle className="size-3 shrink-0" />
                  {translate("resources.deals.fields.on_hold")}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {moneybird && (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 px-1.5 py-0 text-[11px] font-normal"
                  >
                    <Receipt className="size-3 shrink-0" />
                    {moneybird}
                  </Badge>
                )}
                <AssigneesField
                  ids={deal.assignee_ids}
                  size={16}
                  showParties={false}
                />
              </div>
            </div>
            {!attentionPipeline ? (
              <DealWorkflowIndicator
                deal={deal}
                openTasks={openTasks}
                onPlanTask={onPlanTask ? () => onPlanTask(deal) : undefined}
              />
            ) : null}
            <MoneybirdCardActions record={deal} />
            <InzyteCardActions record={deal} />
            {attentionPipeline && onMoveToStage && onPlanTask ? (
              <AttentionDealActions
                deal={deal}
                onMoveToStage={onMoveToStage}
                onPlanTask={onPlanTask}
              />
            ) : null}
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
