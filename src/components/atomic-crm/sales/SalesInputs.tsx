import {
  email,
  required,
  useGetIdentity,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";
import { PARTY_META, PARTY_OPTIONS } from "./party";

export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  const translate = useTranslate();
  const partyChoices = PARTY_OPTIONS.map((option) => ({
    id: option.value,
    name: translate(PARTY_META[option.value].labelKey, {
      _: option.fallback,
    }),
  }));
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <TextInput
        source="email"
        validate={[required(), email()]}
        helperText={false}
      />
      <SelectInput
        source="partij"
        choices={partyChoices}
        validate={required()}
        defaultValue="marketingbende"
        helperText={false}
      />
      <NumberInput
        source="hourly_rate"
        min={0}
        step={0.01}
        helperText="resources.sales.fields.hourly_rate_helper"
      />
      <BooleanInput
        source="administrator"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <BooleanInput
        source="disabled"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
    </div>
  );
}
