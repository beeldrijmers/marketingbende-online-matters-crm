import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Deal } from "../../types";
import { InzyteWorkspace } from "./InzyteWorkspace";

const INZYTE_SOURCES = [
  {
    label: "GA4",
    isActive: (record: Deal) =>
      Boolean(
        record.inzyte_link?.ga4_connection_id &&
          record.inzyte_link?.ga4_property_id,
      ),
  },
  {
    label: "GSC",
    isActive: (record: Deal) => Boolean(record.inzyte_link?.gsc_site_url),
  },
  {
    label: "GBP",
    isActive: (record: Deal) => Boolean(record.inzyte_link?.gbp_location_id),
  },
  {
    label: "Ads",
    isActive: (record: Deal) => Boolean(record.inzyte_link?.ads_customer_id),
  },
];

const REPORT_MONTH_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthLabel = (value: string): string =>
  REPORT_MONTH_FORMATTER.format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));

export const InzyteDealSection = ({ record }: { record: Deal }) => {
  const activeSources = INZYTE_SOURCES.filter((source) =>
    source.isActive(record),
  );
  const connectionLabel = record.inzyte_link?.last_error
    ? "Koppeling vraagt aandacht"
    : activeSources.length === 1
      ? `${activeSources[0].label}-bron gekoppeld`
      : activeSources.length > 1
        ? `${activeSources.length} meetbronnen gekoppeld`
        : record.inzyte_link
          ? "Account gekoppeld, meetbron ontbreekt"
          : "Nog niet gekoppeld";

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
                record.inzyte_link?.last_error
                  ? "border-rose-500/40 text-rose-600"
                  : activeSources.length > 0
                    ? "border-emerald-500/40 text-emerald-600"
                    : "border-amber-500/40 text-amber-600",
              )}
            >
              {connectionLabel}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Vergelijk SEO-resultaten maand-op-maand, combineer ze met de
            uitgevoerde werkzaamheden en maak een klantklare PDF.
          </p>
          {record.inzyte_link ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {INZYTE_SOURCES.map((source) => {
                const active = source.isActive(record);
                return (
                  <Badge
                    key={source.label}
                    variant="secondary"
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      active
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {source.label} {active ? "✓" : "—"}
                  </Badge>
                );
              })}
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
