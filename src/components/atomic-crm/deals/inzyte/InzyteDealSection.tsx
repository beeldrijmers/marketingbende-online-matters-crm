import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Deal } from "../../types";
import { InzyteWorkspace } from "./InzyteWorkspace";
import {
  getInzyteConnectionSummary,
  getInzyteSourceStates,
} from "./inzyteVerification";

const REPORT_MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthLabel = (value: string): string =>
  REPORT_MONTH_FORMATTER.format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));

export const InzyteDealSection = ({ record }: { record: Deal }) => {
  const sourceStates = getInzyteSourceStates(record.inzyte_link);
  const connection = getInzyteConnectionSummary(record.inzyte_link);

  return (
    <section
      aria-label="Inzyte-klantverdieping"
      className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
          <BarChart3 className="size-5" />
        </div>
        <div className="min-w-56 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              Klantinzichten & SEO-maandrapportage
            </h3>
            <Badge
              variant="outline"
              className={cn(
                connection.tone === "error"
                  ? "border-rose-500/40 text-rose-600"
                  : connection.tone === "success"
                    ? "border-emerald-500/40 text-emerald-600"
                    : connection.tone === "warning"
                      ? "border-amber-500/40 text-amber-600"
                      : "text-muted-foreground",
              )}
            >
              {connection.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Vergelijk SEO-resultaten maand-op-maand, combineer ze met de
            uitgevoerde werkzaamheden en maak een klantklare PDF.
          </p>
          {record.inzyte_link ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sourceStates.map((source) => (
                <Badge
                  key={source.key}
                  variant="secondary"
                  title={
                    source.verified
                      ? `${source.label} is voor deze opdracht gecontroleerd`
                      : source.configured
                        ? `${source.label} is ingesteld maar nog niet gecontroleerd`
                        : `${source.label} is niet ingesteld`
                  }
                  className={cn(
                    "text-[10px] uppercase tracking-wide",
                    source.verified
                      ? "bg-emerald-500/10 text-emerald-600"
                      : source.configured
                        ? "bg-amber-500/10 text-amber-600"
                        : "text-muted-foreground/60",
                  )}
                >
                  {source.shortLabel}{" "}
                  {source.verified ? "✓" : source.configured ? "?" : "—"}
                </Badge>
              ))}
              {record.latest_seo_report ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    record.latest_seo_report.status === "final"
                      ? "border-emerald-500/40 text-emerald-600"
                      : "border-amber-500/40 text-amber-600",
                  )}
                >
                  SEO {monthLabel(record.latest_seo_report.reporting_month)} ·{" "}
                  {record.latest_seo_report.status === "final"
                    ? "definitief"
                    : "concept"}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        <InzyteWorkspace record={record} />
      </div>
    </section>
  );
};
