import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";
import type { PopoverProps } from "@radix-ui/react-popover";

export const AutocompleteCompanyInput = ({
  validate,
  label,
  modal,
}: Pick<InputProps, "validate" | "label"> & Pick<PopoverProps, "modal">) => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const handleCreateCompany = async (name?: string) => {
    if (!name) return;
    try {
      const newCompany = await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newCompany;
    } catch {
      notify("resources.companies.autocomplete.create_error", {
        type: "error",
        messageArgs: {
          _: "An error occurred while creating the company",
        },
      });
    }
  };

  return (
    <AutocompleteInput
      label={label}
      optionText="name"
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel="resources.companies.autocomplete.create_item"
      createLabel="resources.companies.autocomplete.create_label"
      validate={validate}
      // No modal popover: a Radix modal Popover leaves pointer-events:none on
      // the body after it closes on selection, freezing the rest of the contact
      // form (the email field) — reproduced on mobile. Non-modal avoids that.
      modal={modal}
    />
  );
};
