import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

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
  return (
    <>
      <Header />
      <main className="max-w-screen-xl mx-auto pt-4 px-4" id="main-content">
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </>
  );
};
