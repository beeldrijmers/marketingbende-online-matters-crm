import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required, useRecordContext, useTranslate } from "ra-core";
import { DateTimeInput } from "@/components/admin";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Sale, Task } from "../types";

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

export const TaskFormContent = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const { taskTypes } = useConfigurationContext();
  const translate = useTranslate();
  // Trello owns the text of trello-sourced steps: local edits would be
  // overwritten by the next sync, so the field is read-only for those tasks.
  // In create forms there is no record, so the field stays editable.
  const record = useRecordContext<Task>();
  const isTrelloTask = record?.source === "trello";
  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus={!isTrelloTask}
        source="text"
        validate={required()}
        multiline
        className="m-0"
        readOnly={isTrelloTask}
        helperText={
          isTrelloTask
            ? translate("resources.tasks.trello_text_readonly", {
                _: "Deze stap komt uit Trello. Pas de omschrijving aan in Trello; wijzigingen hier worden bij de volgende synchronisatie overschreven.",
              })
            : false
        }
      />
      {selectContact && (
        <ReferenceInput source="contact_id" reference="contacts_summary">
          <AutocompleteInput
            label="resources.tasks.fields.contact_id"
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
            modal
          />
        </ReferenceInput>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateTimeInput
          source="due_date"
          helperText={false}
          validate={required()}
        />
        <SelectInput
          source="type"
          validate={required()}
          choices={taskTypes}
          optionText="label"
          optionValue="value"
          defaultValue="none"
          helperText={false}
        />
      </div>

      <ReferenceInput
        reference="sales"
        source="sales_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          helperText={false}
          optionText={saleOptionRenderer}
          validate={required()}
          label={translate("resources.tasks.fields.sales_id", {
            _: "Toegewezen aan",
          })}
        />
      </ReferenceInput>
    </div>
  );
};
