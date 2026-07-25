import type { ReactNode } from "react";

import { MobileContent } from "./MobileContent";
import MobileHeader from "./MobileHeader";

/**
 * A phone screen with a titled bar: the same page identity the desktop gets
 * from <PageHeader>, in the fixed top bar where the thumb expects it.
 */
export const MobilePage = ({
  actions,
  children,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  title: ReactNode;
}) => (
  <>
    <MobileHeader>
      <h1 className="min-w-0 flex-1 truncate text-lead font-semibold text-ink">
        {title}
      </h1>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </MobileHeader>
    <MobileContent>{children}</MobileContent>
  </>
);
