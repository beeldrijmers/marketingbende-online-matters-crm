import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { MobileNavigation } from "./MobileNavigation";

const MobilePageLoadingSkeleton = () => (
  <div className="pt-18 pb-20 px-4 min-h-screen flex flex-col gap-4">
    <Skeleton className="h-8 w-2/3" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <>
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<MobilePageLoadingSkeleton />}>{children}</Suspense>
      </ErrorBoundary>
      <MobileNavigation />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </>
  );
};
