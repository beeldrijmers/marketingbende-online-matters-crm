import type { ReactNode } from "react";

import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

/**
 * The save bar: pinned to the bottom of the form, on its own surface.
 *
 * It used to fade out over a gradient inside the card, which made "Opslaan"
 * hard to spot on long forms and impossible to reach without scrolling to the
 * very end.
 */
export const FormToolbar = ({
  children,
  saveLabel,
}: {
  children?: ReactNode;
  saveLabel?: string;
}) => (
  <div
    role="toolbar"
    className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-row items-center justify-end gap-2 border-t border-line-subtle bg-raised px-4 py-3"
  >
    {children}
    <CancelButton />
    <SaveButton label={saveLabel} />
  </div>
);
