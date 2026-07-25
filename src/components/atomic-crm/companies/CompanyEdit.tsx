import { EditBase, Form, useEditContext, useTranslate } from "ra-core";

import { FormToolbar } from "../layout/FormToolbar";
import { RecordFormShell } from "../layout/RecordFormShell";
import type { Company } from "../types";
import { CompanyAside } from "./CompanyAside";
import { CompanyInputs } from "./CompanyInputs";

export const CompanyEdit = () => (
  <EditBase
    actions={false}
    redirect="show"
    transform={(values) => {
      // add https:// before website if not present
      if (values.website && !values.website.startsWith("http")) {
        values.website = `https://${values.website}`;
      }
      return values;
    }}
  >
    <CompanyEditContent />
  </EditBase>
);

const CompanyEditContent = () => {
  const translate = useTranslate();
  const { isPending, record } = useEditContext<Company>();
  if (isPending || !record) return null;
  return (
    <RecordFormShell
      title={record.name}
      meta={translate("resources.companies.action.edit", {
        _: "Bedrijf bewerken",
      })}
      backTo={`/companies/${record.id}/show`}
      backLabel={translate("ra.action.cancel", { _: "Terug" })}
      aside={<CompanyAside link="show" />}
    >
      <Form className="panel px-4 py-4">
        <CompanyInputs />
        <FormToolbar />
      </Form>
    </RecordFormShell>
  );
};
