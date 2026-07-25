import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { PageHeader } from "./PageHeader";

/**
 * The frame every create/edit screen shares: it says what you are filling in,
 * how to get back, and keeps the form to a readable measure.
 *
 * Forms used to open as an unlabelled card in the middle of the page — no
 * heading, no way back, and a save button that scrolled away with the content.
 */
export const RecordFormShell = ({
  aside,
  backLabel,
  backTo,
  children,
  meta,
  title,
}: {
  aside?: ReactNode;
  backLabel?: string;
  backTo?: string;
  children: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) => (
  <>
    <PageHeader
      title={title}
      meta={meta}
      actions={
        backTo ? (
          <Button asChild variant="ghost" size="sm">
            <Link to={backTo}>
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </Button>
        ) : undefined
      }
    />
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 lg:max-w-3xl">{children}</div>
      {aside}
    </div>
  </>
);
