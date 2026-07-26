import { MessageSquareShare } from "lucide-react";
import { RecordContextProvider, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { getDashboardDealDetailPath } from "../deals/dashboardDealSelection";
import { SectionHeader } from "../layout/SectionHeader";
import { BOARD_PATH } from "../root/routes";
import type { Deal } from "../types";
import {
  selectSilentClients,
  SILENCE_THRESHOLD_DAYS,
} from "./silentClientsModel";

const PAGE_SIZE = 5;

/**
 * The clients who have not heard anything for a while.
 *
 * Without this the status update is a feature you have to remember; with it the
 * CRM does the remembering. A board shows what the work is doing, never whether
 * the person paying for it knows — and that is the silence a client complains
 * about, not the delay itself.
 */
export const SilentClients = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });

  const rows = useMemo(() => selectSilentClients(deals), [deals]);
  const dealsById = useMemo(
    () => new Map(deals.map((deal) => [String(deal.id), deal] as const)),
    [deals],
  );

  if (isPending) {
    return (
      <section className="flex min-w-0 flex-col gap-3.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </section>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        count={rows.length}
        meta={translate("crm.dashboard.silent.subtitle", {
          days: SILENCE_THRESHOLD_DAYS,
          _: `Open werk waarover de klant ${SILENCE_THRESHOLD_DAYS} dagen of langer niets hoorde.`,
        })}
        title={translate("crm.dashboard.silent.title", {
          _: "Klant wacht op nieuws",
        })}
      />

      <div className="panel divide-y divide-line-subtle overflow-hidden">
        {rows.slice(0, PAGE_SIZE).map((row) => {
          const deal = dealsById.get(String(row.dealId));
          if (!deal) return null;

          return (
            <RecordContextProvider key={row.dealId} value={deal}>
              <Link
                className="flex min-w-0 items-center gap-2.5 p-3 no-underline transition-colors duration-1 hover:bg-sunken"
                to={getDashboardDealDetailPath(BOARD_PATH, row.dealId)}
              >
                <ReferenceField
                  link={false}
                  reference="companies"
                  source="company_id"
                >
                  <CompanyAvatar height={20} width={20} />
                </ReferenceField>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">
                    <ReferenceField
                      link={false}
                      reference="companies"
                      source="company_id"
                    />
                  </span>
                  <span className="block truncate text-meta text-ink-3">
                    {row.dealName}
                  </span>
                </span>

                <span
                  className={cn(
                    "num shrink-0 text-meta",
                    row.daysSilent == null ? "text-late" : "text-ink-2",
                  )}
                >
                  {row.daysSilent == null
                    ? translate("crm.dashboard.silent.never", {
                        _: "nooit geïnformeerd",
                      })
                    : translate("crm.dashboard.silent.days", {
                        count: row.daysSilent,
                        _: `${row.daysSilent} dagen stil`,
                      })}
                </span>
                <MessageSquareShare className="size-4 shrink-0 text-ink-3" />
              </Link>
            </RecordContextProvider>
          );
        })}
      </div>

      {rows.length > PAGE_SIZE ? (
        <p className="self-end text-meta text-ink-3">
          {translate("crm.dashboard.silent.more", {
            count: rows.length - PAGE_SIZE,
            _: `Nog ${rows.length - PAGE_SIZE} wachten op nieuws`,
          })}
        </p>
      ) : null}
    </section>
  );
};
