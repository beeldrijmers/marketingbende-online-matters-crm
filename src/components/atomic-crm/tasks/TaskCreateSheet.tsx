import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import type { CrmDataProvider } from "../providers/types";
import { foreignKeyMapping } from "../notes/foreignKeyMapping";
import { TaskFormContent } from "./TaskFormContent";
import { useQueryClient } from "@tanstack/react-query";

export interface TaskCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
  deal_id?: Identifier;
}

export const TaskCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
  deal_id,
}: TaskCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const selectContact = contact_id == null && deal_id == null;
  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: contact_id != null },
  );
  const [update] = useUpdate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();

  if (!identity) return null;

  const handleSuccess = async (data: any) => {
    const referenceRecordId = data[foreignKeyMapping["contacts"]];
    if (referenceRecordId) {
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: referenceRecordId,
      });
      if (contact) {
        await update("contacts", {
          id: referenceRecordId as unknown as Identifier,
          data: { last_seen: new Date().toISOString() },
          previousData: contact,
        });
        queryClient.invalidateQueries({
          queryKey: ["contacts", "getOne"],
        });
      }
    }

    // Een taak op een opdracht hoort ook op de Trello-kaart te staan, anders is
    // het bord de bron en Kompas een kijkvenster. Bewust na de melding en zonder
    // de dialoog open te houden: lukt het spiegelen niet, dan is de taak er wel.
    if (data?.deal_id != null) {
      try {
        await dataProvider.mirrorTaskToTrello(data.id);
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "De taak staat in Kompas, maar niet op de Trello-kaart",
          { type: "warning" },
        );
      }
    }

    notify("resources.tasks.added");
    // No redirect, only close the sheet
    onOpenChange(false);
  };

  return (
    <CreateSheet
      resource="tasks"
      title={
        <span className="text-xl font-semibold truncate pr-10">
          {!selectContact
            ? deal_id != null
              ? translate("resources.tasks.dialog.create_for_deal", {
                  _: "Volgende taak voor deal",
                })
              : translate("resources.tasks.dialog.create_for", {
                  name: getContactRepresentation(contact!),
                })
            : translate("resources.tasks.dialog.create")}
        </span>
      }
      redirect={false}
      record={{
        type: "none",
        contact_id,
        deal_id,
        due_date: new Date().toISOString(),
        sales_id: identity.id,
      }}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TaskFormContent selectContact={selectContact} />
    </CreateSheet>
  );
};
