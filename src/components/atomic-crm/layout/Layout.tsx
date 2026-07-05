import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";

const PageLoadingSkeleton = () => (
  <div className="flex flex-col gap-4 py-2">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const location = useLocation();
  // The deals kanban needs every horizontal pixel it can get; all other pages
  // stay centered at a comfortable reading width.
  const fullBleed = location.pathname.startsWith("/deals");
  return (
    <>
      <Header />
      <main
        className={cn(
          "mx-auto pt-4 px-4",
          fullBleed ? "max-w-full" : "max-w-screen-xl",
        )}
        id="main-content"
      >
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </>
  );
};
