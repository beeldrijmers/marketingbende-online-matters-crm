import {
  EditBase,
  Form,
  useEditContext,
  useTranslate,
  type MutationMode,
} from "ra-core";

import type { Contact } from "../types";
import { ContactAside } from "./ContactAside";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { RecordFormShell } from "../layout/RecordFormShell";
import {
  cleanupContactForEdit,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export const ContactEdit = ({
  mutationMode,
}: {
  mutationMode?: MutationMode;
}) => (
  <EditBase
    redirect="show"
    transform={cleanupContactForEdit}
    mutationMode={mutationMode}
  >
    <ContactEditContent />
  </EditBase>
);

const normalizeContactArrayFields = (record: Contact) => ({
  ...record,
  email_jsonb:
    record.email_jsonb && record.email_jsonb.length > 0
      ? record.email_jsonb
      : defaultEmailJsonb,
  phone_jsonb:
    record.phone_jsonb && record.phone_jsonb.length > 0
      ? record.phone_jsonb
      : defaultPhoneJsonb,
});

const ContactEditContent = () => {
  const translate = useTranslate();
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <RecordFormShell
      title={`${record.first_name ?? ""} ${record.last_name ?? ""}`.trim()}
      meta={translate("resources.contacts.action.edit", {
        _: "Contact bewerken",
      })}
      backTo={`/contacts/${record.id}/show`}
      backLabel={translate("ra.action.cancel", { _: "Terug" })}
      aside={<ContactAside link="show" />}
    >
      <Form
        className="panel px-4 py-4"
        record={normalizeContactArrayFields(record)}
      >
        <ContactInputs />
        <FormToolbar />
      </Form>
    </RecordFormShell>
  );
};
