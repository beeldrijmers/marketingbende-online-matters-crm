import { ChevronDown, TrendingUp } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RevenueDashboard = lazy(() =>
  import("./RevenueDashboard").then((module) => ({
    default: module.RevenueDashboard,
  })),
);

export const RevenueDisclosure = ({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Card className="p-0">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start rounded-xl px-4 py-3"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <TrendingUp className="size-5 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-semibold">Omzet en prognose</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Open de maandgrafiek en controleer ontbrekende planning
            </span>
          </span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </Card>
      {open ? (
        <Suspense fallback={<Skeleton className="h-[440px] w-full" />}>
          <RevenueDashboard />
        </Suspense>
      ) : null}
    </section>
  );
};
