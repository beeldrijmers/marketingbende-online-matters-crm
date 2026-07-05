import { Draggable } from "@hello-pangea/dnd";
import { useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

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
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-2">
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
              <span className="text-sm font-semibold text-foreground">
                <NumberField
                  source="amount"
                  options={{
                    notation: "compact",
                    style: "currency",
                    currency,
                    currencyDisplay: "narrowSymbol",
                    minimumSignificantDigits: 3,
                  }}
                  locales="nl-NL"
                  empty="Geen bedrag"
                />
              </span>
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
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
