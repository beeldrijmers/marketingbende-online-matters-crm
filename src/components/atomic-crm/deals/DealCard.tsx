import { Draggable } from "@hello-pangea/dnd";
import { FileBarChart, PauseCircle, Receipt } from "lucide-react";
import { useRedirect, useTranslate, RecordContextProvider } from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectField } from "@/components/admin/select-field";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { AssigneesField } from "../sales/AssigneesField";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";
import { AttentionDealActions } from "./AttentionDealActions";
import { DealWorkflowIndicator } from "./DealWorkflowIndicator";
import { getDashboardDealDetailPath } from "./dashboardDealSelection";
import { getDealWorkflow } from "./dealWorkflow";

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

const SEO_REPORT_MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "short",
  timeZone: "UTC",
});

const seoReportLabel = (deal: Deal): string | null => {
  const report = deal.latest_seo_report;
  if (!report) return null;
  const month = SEO_REPORT_MONTH_FORMATTER.format(
    new Date(`${report.reporting_month.slice(0, 7)}-01T00:00:00Z`),
  );
  return `SEO ${month} · ${report.status === "final" ? "klaar" : "concept"}`;
};

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

/**
 * A work ticket, read top to bottom: who it is for, what it is, what it is
 * worth, and only then whether it needs a person.
 *
 * The card used to open with "Bedrijfsnaam - Dealnaam" glued into one
 * paragraph, and closed with a full-width red bar that nearly every card
 * carried. Now the client is the anchor, the left edge lights up only when
 * something is genuinely late, and the state is one quiet line.
 */
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
  // Clicking opens the dialog over the board (context stays visible); the
  // client name is a real link to the page, so Cmd-click and "open in new tab"
  // do what they do everywhere else.
  const dialogPath = detailBasePath
    ? getDashboardDealDetailPath(detailBasePath, deal.id)
    : `/deals/${deal.id}/show`;
  const pagePath = `/deals/${deal.id}/show`;
  const handleClick = () => {
    redirect(dialogPath, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  const formattedAmount = deal.amount
    ? formatCurrency(deal.amount, currency)
    : null;
  const recurring = isRecurringDeal(deal);
  const moneybird = moneybirdLabel(deal);
  const seoReport = seoReportLabel(deal);
  const workflow = getDealWorkflow(deal, openTasks);
  // The left edge is the card's only alarm, and it earns its colour.
  const edge =
    workflow.kind === "overdue"
      ? "before:bg-late"
      : workflow.kind === "today"
        ? "before:bg-wait"
        : deal.on_hold
          ? "before:bg-wait/45"
          : "before:bg-transparent";

  return (
    <article
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-md border border-line-subtle bg-raised shadow-e1 transition-[transform,box-shadow,border-color] duration-1",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        edge,
        "hover:-translate-y-px hover:border-line hover:shadow-e2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        snapshot?.isDragging && "rotate-[0.4deg] opacity-95 shadow-e3",
      )}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
      // No role/tabIndex/keydown of our own: the drag library owns the keyboard
      // contract on this node (space lifts the card), and the client name below
      // is a real link, so the keyboard and Cmd-click both work properly.
    >
      <RecordContextProvider value={deal}>
        <div className="flex flex-col gap-1 pl-3 pr-2 py-2">
          <div className="flex items-center gap-1.5">
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            >
              <CompanyAvatar width={16} height={16} />
            </ReferenceField>
            <Link
              to={pagePath}
              onClick={(event) => {
                // A plain click keeps the board behind the dialog; modifier
                // clicks fall through to the browser's own link handling.
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                event.stopPropagation();
                handleClick();
              }}
              className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold leading-5 text-ink no-underline hover:underline"
            >
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              />
            </Link>
            <AssigneesField
              ids={deal.assignee_ids}
              size={16}
              showParties={false}
            />
          </div>

          <p className="line-clamp-2 text-meta leading-[1.15rem] text-ink-2">
            {deal.name}
          </p>

          <div className="flex items-center gap-1.5">
            {formattedAmount ? (
              <span className="num text-[0.8125rem] font-semibold text-ink">
                {formattedAmount}
                {recurring && (
                  <span className="ml-0.5 text-meta font-normal text-ink-3">
                    {translate("resources.deals.per_month_suffix")}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-meta text-ink-3">
                {translate("resources.deals.no_amount")}
              </span>
            )}
            {deal.category ? (
              <span className="min-w-0 truncate text-meta text-ink-3">
                <span aria-hidden>· </span>
                <SelectField
                  source="category"
                  choices={dealCategories}
                  optionText="label"
                  optionValue="value"
                  empty={deal.category}
                />
              </span>
            ) : null}
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-ink-3">
              {deal.on_hold ? (
                <PauseCircle
                  className="size-3.5 text-wait"
                  aria-label={translate("resources.deals.fields.on_hold")}
                />
              ) : null}
              {seoReport ? (
                <FileBarChart
                  className={cn(
                    "size-3.5",
                    deal.latest_seo_report?.status === "final"
                      ? "text-live"
                      : "text-wait",
                  )}
                  aria-label={seoReport}
                />
              ) : null}
              {moneybird ? (
                <Receipt className="size-3.5" aria-label={moneybird} />
              ) : null}
            </span>
          </div>

          <DealWorkflowIndicator
            dense={!attentionPipeline}
            deal={deal}
            openTasks={openTasks}
            onPlanTask={onPlanTask ? () => onPlanTask(deal) : undefined}
          />

          {attentionPipeline && onMoveToStage && onPlanTask ? (
            <AttentionDealActions
              deal={deal}
              onMoveToStage={onMoveToStage}
              onPlanTask={onPlanTask}
            />
          ) : null}
        </div>
      </RecordContextProvider>
    </article>
  );
};
