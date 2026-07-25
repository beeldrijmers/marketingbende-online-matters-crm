import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A page's content, held to a readable measure (--page-max).
 *
 * On a 2560px display an uncapped row put the client name at the far left and
 * its status at the far right with a metre of nothing in between. The board is
 * the deliberate exception: its columns use every pixel they can get.
 */
export const PageBody = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("mx-auto w-full max-w-[--page-max]", className)}>
    {children}
  </div>
);
