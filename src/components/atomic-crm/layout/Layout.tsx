import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { AppSidebar } from "./AppSidebar";

const PageLoadingSkeleton = () => (
  <div className="flex flex-col gap-4 pt-2">
    <Skeleton className="h-7 w-56" />
    <Skeleton className="h-28 w-full" />
    <Skeleton className="h-28 w-full" />
  </div>
);

/**
 * The desktop shell: a persistent navigation rail plus one scrolling work area.
 *
 * The work area owns the viewport height (`h-dvh` here, `min-h-0` below), which
 * lets full-height pages such as the board fill the screen with `h-full`
 * instead of guessing at `calc(100dvh - 22rem)`.
 */
export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <AppSidebar />
      <main
        id="main-content"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6 pt-4 lg:px-6"
      >
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </div>
  );
};
