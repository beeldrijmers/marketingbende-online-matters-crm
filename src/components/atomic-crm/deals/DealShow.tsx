import { ShowBase, useTranslate } from "ra-core";
import { useNavigate } from "react-router";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { BOARD_PATH } from "./dashboardDealSelection";
import { DealShowBody } from "./DealShowBody";

/**
 * The deal detail, opened over the board it was clicked from.
 *
 * The same content also has its own route (<DealShowPage>), so a middle-click
 * or Cmd-click on a card opens a full page instead — the dialog keeps the board
 * behind it, the page makes the deal linkable.
 */
export const DealShow = ({
  closeTo = BOARD_PATH,
  editTo,
  open,
  id,
}: {
  closeTo?: string;
  editTo?: string;
  open: boolean;
  id?: string;
}) => {
  const navigate = useNavigate();
  const handleClose = () => {
    // Replace (not push) the detail entry with its originating board so the
    // browser back button lands before the dialog was opened instead of
    // reopening it. Works for deep links too, unlike navigate(-1).
    navigate(closeTo, { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[4vh] max-h-[92vh] translate-y-0 overflow-y-auto p-5 lg:max-w-5xl"
      >
        <DealDialogTitle />
        {id ? (
          <ShowBase id={id}>
            <DealShowBody closeTo={closeTo} editTo={editTo} />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const DealDialogTitle = () => {
  const translate = useTranslate();
  return (
    <DialogTitle className="sr-only">
      {translate("resources.deals.forcedCaseName")}
    </DialogTitle>
  );
};
