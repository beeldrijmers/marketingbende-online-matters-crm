import { Draggable } from "@hello-pangea/dnd";
import { CalendarClock, Flag, PauseCircle, Receipt } from "lucide-react";
import { useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { AssigneesField } from "../sales/AssigneesField";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

// A monthly/recurring price hint anywhere in the card text ("EUR 300 p/m",
// "per maand", "maandelijks") means we show the amount as a /mnd rate.
const RECURRING_RE = /per\s*maand|p\/m|\/\s*mnd|\bmnd\b|maandelijks/i;
const isRecurringDeal = (deal: Deal): boolean =>
  RECURRING_RE.test(`${deal.name ?? ""} ${deal.description ?? ""}`);

const formatMonthYear = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
};

const formatDayMonth = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
};

// The synced description carries a "Bron (Trello): <url>" trailer and, when the
// card had no text, a "Gemigreerd vanuit Trello:" placeholder. Strip both and
// return the first real line, or null when there is nothing meaningful to show.
const descriptionSnippet = (raw?: string | null): string | null => {
  if (!raw) return null;
  const sourceIdx = raw.indexOf("Bron (Trello):");
  const body = sourceIdx === -1 ? raw : raw.slice(0, sourceIdx);
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine || firstLine.startsWith("Gemigreerd vanuit Trello:")) {
    return null;
  }
  return firstLine;
};

const moneybirdLabel = (deal: Deal): string | null =>
  deal.moneybird_invoice_id
    ? "Factuur"
    : deal.moneybird_estimate_id
      ? "Offerte"
      : null;

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  const formattedAmount = deal.amount
    ? new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(deal.amount)
    : null;
  const recurring = isRecurringDeal(deal);
  const startedLabel = formatMonthYear(deal.created_at);
  const closingLabel = formatDayMonth(deal.expected_closing_date);
  const snippet = descriptionSnippet(deal.description);
  const moneybird = moneybirdLabel(deal);

  return (
    <div
      className="cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={cn(
            "py-3 transition-all duration-200",
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md",
          )}
        >
          <CardContent className="px-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm font-medium leading-snug">
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

            <div className="flex items-center justify-between gap-2">
              {formattedAmount ? (
                <span className="text-base font-bold text-foreground">
                  {formattedAmount}
                  {recurring && (
                    <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                      /mnd
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Nog geen bedrag
                </span>
              )}
              {deal.category && (
                <Badge variant="secondary" className="shrink-0">
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
                  className="shrink-0 gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  <PauseCircle className="size-3 shrink-0" />
                  In de wacht
                </Badge>
              )}
            </div>

            {(startedLabel || closingLabel) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {startedLabel && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3 shrink-0" />
                    Sinds {startedLabel}
                  </span>
                )}
                {closingLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Flag className="size-3 shrink-0" />
                    Oplevering {closingLabel}
                  </span>
                )}
              </div>
            )}

            {snippet && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {snippet}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <AssigneesField
                ids={deal.assignee_ids}
                size={16}
                className="text-xs text-muted-foreground"
              />
              {moneybird && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 text-xs font-normal"
                >
                  <Receipt className="size-3 shrink-0" />
                  {moneybird}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
