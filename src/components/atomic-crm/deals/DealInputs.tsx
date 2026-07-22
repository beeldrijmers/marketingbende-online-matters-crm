import { endOfMonth, format } from "date-fns";
import { required, useTranslate } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";

// Whether the deal's amount recurs monthly or is a one-off fee; drives the
// revenue dashboard (MRR vs one-off). Left blank when not applicable. The
// labels are i18n keys; SelectInput translates them (translateChoice).
const REVENUE_PERIOD_CHOICES = [
  {
    value: "maandelijks",
    label: "resources.deals.revenue_period_options.maandelijks",
  },
  {
    value: "eenmalig",
    label: "resources.deals.revenue_period_options.eenmalig",
  },
];

const defaultDeadline = (): string =>
  format(endOfMonth(new Date()), "yyyy-MM-dd");

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.inputs.linked_to")}
      </h3>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          validate={required()}
          modal
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteArrayInput
          label="resources.deals.fields.contact_ids"
          optionText={contactOptionText}
          helperText={false}
        />
      </ReferenceArrayInput>

      {/* Who can see this card. A deal is only visible to its assignees, so an
          empty list would hide it; the DealCreate default and the DB trigger
          keep the creator/owner assigned. */}
      <ReferenceArrayInput source="assignee_ids" reference="sales">
        <AutocompleteArrayInput
          label="resources.deals.fields.assignee_ids"
          optionText={saleOptionText}
          helperText="resources.deals.fields.assignee_ids_helper"
        />
      </ReferenceArrayInput>
    </div>
  );
};

// A sales user shown as "First Last" in the assignee picker.
const saleOptionText = (sale: { first_name?: string; last_name?: string }) =>
  [sale.first_name, sale.last_name].filter(Boolean).join(" ").trim() ||
  "Onbekend";

const DealMiscInputs = () => {
  const { dealStages, dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.misc")}
      </h3>

      <SelectInput
        source="category"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <NumberInput
        source="amount"
        min={0}
        helperText="resources.deals.fields.amount_helper"
      />
      <SelectInput
        source="revenue_period"
        choices={REVENUE_PERIOD_CHOICES}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <DateInput source="start_date" helperText={false} />
      <DateInput source="delivery_date" helperText={false} />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={defaultDeadline()}
      />
      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue={dealStages[0]?.value}
        helperText={false}
        validate={required()}
      />
      <BooleanInput
        source="is_internal"
        label="resources.deals.fields.is_internal"
        helperText={false}
      />
    </div>
  );
};
