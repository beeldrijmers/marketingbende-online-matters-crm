import { CalendarCheck, MessageSquareShare, PackageCheck } from "lucide-react";
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
import { selectUpdateMoments, type UpdateMoment } from "./updateMomentsModel";

const PAGE_SIZE = 6;

/**
 * The updates that are due, in this team's rhythm: at delivery of a project and
 * at the monthly close of recurring SEO work.
 *
 * Without this the status update is a feature you have to remember. It
 * deliberately does not nag about work in progress — that is not news — and it
 * does not go quiet about finished work, which is exactly when a client is
 * waiting to hear from us.
 */
export const UpdateMoments = () => {
  const translate = useTranslate();
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "archived_at@is": null },
  });

  const moments = useMemo(() => selectUpdateMoments(deals), [deals]);
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

  if (moments.length === 0) return null;

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        count={moments.length}
        meta={translate("crm.dashboard.update_moments.subtitle", {
          _: "Bij oplevering van een project en bij de maandafsluiting.",
        })}
        title={translate("crm.dashboard.update_moments.title", {
          _: "Klant bijpraten",
        })}
      />

      <div className="panel divide-y divide-line-subtle overflow-hidden">
        {moments.slice(0, PAGE_SIZE).map((moment) => {
          const deal = dealsById.get(String(moment.dealId));
          if (!deal) return null;

          return (
            <RecordContextProvider key={moment.dealId} value={deal}>
              <Link
                className="flex min-w-0 items-center gap-2.5 p-3 no-underline transition-colors duration-1 hover:bg-sunken"
                to={getDashboardDealDetailPath(BOARD_PATH, moment.dealId)}
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
                    {moment.dealName}
                  </span>
                </span>

                <ReasonBadge moment={moment} />
                <MessageSquareShare className="size-4 shrink-0 text-ink-3" />
              </Link>
            </RecordContextProvider>
          );
        })}
      </div>

      {moments.length > PAGE_SIZE ? (
        <p className="self-end text-meta text-ink-3">
          {translate("crm.dashboard.update_moments.more", {
            count: moments.length - PAGE_SIZE,
            _: `Nog ${moments.length - PAGE_SIZE} bij te praten`,
          })}
        </p>
      ) : null}
    </section>
  );
};

/**
 * Why this row is here. Delivered work gets the accent; a monthly round is
 * routine and stays quiet — a screen where everything shouts says nothing.
 */
const ReasonBadge = ({ moment }: { moment: UpdateMoment }) => {
  const translate = useTranslate();
  const waiting =
    moment.daysWaiting != null && moment.daysWaiting > 0
      ? translate("crm.dashboard.update_moments.waiting", {
          count: moment.daysWaiting,
          _: `${moment.daysWaiting} dagen`,
        })
      : null;

  const label =
    moment.reason === "maandafsluiting"
      ? translate("crm.dashboard.update_moments.month", {
          month: moment.monthLabel ?? "",
          _: `maandupdate ${moment.monthLabel ?? ""}`,
        })
      : moment.reason === "project_klaar"
        ? translate("crm.dashboard.update_moments.ready", {
            _: "opgeleverd",
          })
        : translate("crm.dashboard.update_moments.done", {
            _: "afgerond",
          });

  const Icon =
    moment.reason === "maandafsluiting" ? CalendarCheck : PackageCheck;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-meta",
        moment.reason === "maandafsluiting" ? "text-ink-3" : "text-ink-2",
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          moment.reason === "maandafsluiting" ? "text-ink-3" : "text-live",
        )}
      />
      {label}
      {waiting ? <span className="num text-ink-3">· {waiting}</span> : null}
    </span>
  );
};
