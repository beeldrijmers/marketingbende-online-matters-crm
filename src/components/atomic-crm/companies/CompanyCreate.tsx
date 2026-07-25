import { CreateBase, Form, useGetIdentity, useTranslate } from "ra-core";

import { FormToolbar } from "../layout/FormToolbar";
import { RecordFormShell } from "../layout/RecordFormShell";
import { COMPANIES_PATH } from "../root/routes";
import { CompanyInputs } from "./CompanyInputs";

export const CompanyCreate = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  return (
    <CreateBase
      redirect="show"
      transform={(values) => {
        // add https:// before website if not present
        if (values.website && !values.website.startsWith("http")) {
          values.website = `https://${values.website}`;
        }
        return values;
      }}
    >
      <RecordFormShell
        title={translate("resources.companies.action.new", {
          _: "Nieuw bedrijf",
        })}
        backTo={COMPANIES_PATH}
        backLabel={translate("resources.companies.name", { smart_count: 2 })}
      >
        <Form
          className="panel px-4 py-4"
          defaultValues={{ sales_id: identity?.id }}
        >
          <CompanyInputs />
          <FormToolbar
            saveLabel={translate("resources.companies.action.create", {
              _: "Bedrijf aanmaken",
            })}
          />
        </Form>
      </RecordFormShell>
    </CreateBase>
  );
};
