import {
  CreateBase,
  Form,
  useGetIdentity,
  useTranslate,
  type MutationMode,
} from "ra-core";

import { RecordFormShell } from "../layout/RecordFormShell";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { CONTACTS_PATH } from "../root/routes";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export const ContactCreate = ({
  mutationMode,
}: {
  mutationMode?: MutationMode;
}) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();

  return (
    <CreateBase
      redirect="show"
      transform={cleanupContactForCreate}
      mutationMode={mutationMode}
    >
      <RecordFormShell
        title={translate("resources.contacts.action.new", {
          _: "Nieuw contact",
        })}
        backTo={CONTACTS_PATH}
        backLabel={translate("resources.contacts.name", { smart_count: 2 })}
      >
        <Form
          className="panel px-4 py-4"
          defaultValues={{
            sales_id: identity?.id,
            email_jsonb: defaultEmailJsonb,
            phone_jsonb: defaultPhoneJsonb,
          }}
        >
          <ContactInputs />
          <FormToolbar />
        </Form>
      </RecordFormShell>
    </CreateBase>
  );
};
