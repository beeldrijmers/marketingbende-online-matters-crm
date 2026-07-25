import { Translate } from "ra-core";
import type { ReactNode } from "react";

/**
 * One group in the filter rail.
 *
 * The heading used to be bold body text with a 20px icon, and the options were
 * indented by 16px — which left barely 130px for labels like "Cyclische
 * consumentengoederen", so they spilled out of the rail. The heading is a quiet
 * eyebrow now and the options use the full width.
 */
export const FilterCategory = ({
  icon,
  label,
  children,
}: {
  icon?: ReactNode;
  label: string;
  children?: ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <h3 className="eyebrow flex flex-row items-center gap-1.5 px-2 [&>svg]:size-3">
      {icon}
      <Translate i18nKey={label} />
    </h3>
    <div className="flex min-w-0 flex-wrap items-start md:flex-col">
      {children}
    </div>
  </div>
);
