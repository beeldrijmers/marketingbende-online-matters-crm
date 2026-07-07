import type { Identifier } from "ra-core";

import { EditSheet } from "../misc/EditSheet";
import { DealInputs } from "./DealInputs";

export interface DealEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: Identifier;
}

/**
 * Full-screen edit sheet for deals, used on mobile. The desktop edit dialog
 * lives on the /deals/:id route, but the mobile Admin only registers a deals
 * list, so that route would render the bare list; this sheet edits in place
 * without any route change (same pattern as ContactEditSheet).
 */
export const DealEditSheet = ({
  open,
  onOpenChange,
  dealId,
}: DealEditSheetProps) => (
  <EditSheet
    resource="deals"
    id={dealId}
    open={open}
    onOpenChange={onOpenChange}
    mutationMode="pessimistic"
  >
    <DealInputs />
  </EditSheet>
);
