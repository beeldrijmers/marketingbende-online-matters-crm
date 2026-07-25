import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The heading of a panel inside a page.
 *
 * Deliberately without the decorative icon tile that used to sit above every
 * widget title: eight panels each with a 40px coloured square read as a toolbar
 * of logos, not as a hierarchy. Weight and position carry the level instead.
 */
export const SectionHeader = ({
  action,
  className,
  count,
  meta,
  title,
  to,
  toLabel,
}: {
  action?: ReactNode;
  className?: string;
  /** Rendered next to the title as a quiet counter. */
  count?: number;
  meta?: ReactNode;
  title: ReactNode;
  /** Optional "see everything" link, rendered as a quiet text action. */
  to?: string;
  toLabel?: string;
}) => (
  <div className={cn("flex items-baseline justify-between gap-3", className)}>
    <div className="min-w-0">
      <h2 className="flex items-baseline gap-2 text-section text-ink">
        <span className="truncate">{title}</span>
        {count != null ? (
          <span className="num text-meta font-normal text-ink-3">{count}</span>
        ) : null}
      </h2>
      {meta ? <p className="mt-1 text-meta text-ink-3">{meta}</p> : null}
    </div>
    {action ??
      (to ? (
        <Link
          to={to}
          className="flex shrink-0 items-center gap-1 text-meta font-medium text-ink-2 no-underline transition-colors duration-1 hover:text-ink"
        >
          {toLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null)}
  </div>
);
