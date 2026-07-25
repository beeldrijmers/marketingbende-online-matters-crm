import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Every page says what it is and how much of it there is, in the same place.
 *
 * Before, list toolbars floated in the top-right corner with no heading at all,
 * so a screen of rows had no name. Title left, live count underneath, actions
 * right; the band sticks to the top of the scroll container so the actions stay
 * reachable in long lists.
 */
export const PageHeader = ({
  actions,
  children,
  className,
  meta,
  title,
}: {
  actions?: ReactNode;
  /** Controls that belong to the content below (filters, view switches). */
  children?: ReactNode;
  className?: string;
  meta?: ReactNode;
  title: ReactNode;
}) => (
  <header
    className={cn(
      "sticky top-0 z-20 -mx-4 -mt-4 mb-6 border-b border-line-subtle bg-canvas px-4 pb-4 pt-5 lg:-mx-6 lg:px-6",
      className,
    )}
  >
    <div className="mx-auto flex w-full max-w-[--page-max] flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-title text-ink">{title}</h1>
        {meta ? <p className="num mt-1 text-meta text-ink-3">{meta}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
    {children ? (
      <div className="mx-auto mt-4 w-full max-w-[--page-max]">{children}</div>
    ) : null}
  </header>
);
