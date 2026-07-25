import { UserPlus } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { OWNER_UNASSIGNED } from "../deals/ownerScope";
import { SectionHeader } from "../layout/SectionHeader";
import { BOARD_PATH } from "../root/routes";
import { OwnerChip } from "../sales/SaleAvatar";
import type { Deal, Sale, Task } from "../types";
import { buildTeamWorkload, type TeamWorkloadRow } from "./teamWorkloadModel";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  maximumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

/**
 * Who is carrying what, and what nobody has picked up.
 *
 * This replaced a "warme contacten" panel that re-ranked the same deals the
 * attention queue was already showing two columns to the left — the same
 * companies, the same "planning verlopen" badges, a "Heet" label on every row.
 * A second opinion about the same list is not a second piece of information.
 */
export const TeamWorkload = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "archived_at@is": null },
    },
  );
  const { data: tasks = [], isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "due_date", order: "ASC" },
      filter: {},
    },
  );
  const { data: sales = [], isPending: salesPending } = useGetList<Sale>(
    "sales",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
      filter: {},
    },
  );

  const rows = useMemo(() => buildTeamWorkload(deals, tasks), [deals, tasks]);
  const salesById = useMemo(
    () => new Map(sales.map((sale) => [String(sale.id), sale] as const)),
    [sales],
  );
  const busiest = rows.reduce((most, row) => Math.max(most, row.open), 0);
  const isPending = dealsPending || tasksPending || salesPending;

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        title={translate("crm.dashboard.workload.title", { _: "Wie doet wat" })}
        meta={translate("crm.dashboard.workload.subtitle", {
          _: "Open werk per persoon. Klik om het bord daarop te zetten.",
        })}
      />

      <div className="panel divide-y divide-line-subtle overflow-hidden">
        {isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-5 text-body text-ink-2">
            {translate("crm.dashboard.workload.empty", {
              _: "Er staat geen open werk op het bord.",
            })}
          </p>
        ) : (
          rows.map((row) => (
            <WorkloadRow
              key={row.salesId == null ? OWNER_UNASSIGNED : String(row.salesId)}
              busiest={busiest}
              isCurrentUser={
                row.salesId != null &&
                identity?.id != null &&
                String(identity.id) === String(row.salesId)
              }
              row={row}
              sale={
                row.salesId == null
                  ? undefined
                  : salesById.get(String(row.salesId))
              }
            />
          ))
        )}
      </div>
    </section>
  );
};

const WorkloadRow = ({
  busiest,
  isCurrentUser,
  row,
  sale,
}: {
  busiest: number;
  isCurrentUser: boolean;
  row: TeamWorkloadRow;
  sale?: Sale;
}) => {
  const translate = useTranslate();
  const unassigned = row.salesId == null;
  const share = busiest > 0 ? Math.max(row.open / busiest, 0.04) : 0;

  return (
    <Link
      to={`${BOARD_PATH}?owner=${unassigned ? OWNER_UNASSIGNED : row.salesId}`}
      className="flex min-w-0 items-center gap-3 p-3 no-underline transition-colors duration-1 hover:bg-sunken"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-center gap-2 text-body text-ink">
          {unassigned ? (
            <span className="inline-flex items-center gap-1.5 text-wait">
              <UserPlus className="size-4 shrink-0" />
              {translate("crm.dashboard.workload.unassigned", {
                _: "Niet toegewezen",
              })}
            </span>
          ) : (
            <OwnerChip sale={sale} isCurrentUser={isCurrentUser} size={20} />
          )}
        </span>

        {/* One bar per person, scaled to whoever carries the most: the split is
            the point, so it has to be visible without reading numbers. */}
        <span
          aria-hidden="true"
          className="block h-1 w-full max-w-40 overflow-hidden rounded-full bg-sunken"
        >
          <span
            className={cn(
              "block h-full rounded-full",
              unassigned
                ? "bg-wait"
                : isCurrentUser
                  ? "bg-accent-base"
                  : "bg-ink-3",
            )}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5 text-meta">
        <span className="num text-ink-2">
          {translate("crm.dashboard.workload.open", {
            smart_count: row.open,
            _: `${row.open} open`,
          })}
          {row.amount > 0 ? (
            <span className="text-ink-3">
              {" · "}
              {currencyFormatter.format(row.amount)}
            </span>
          ) : null}
        </span>
        {row.attention.total > 0 ? (
          <span
            className={cn(
              "num",
              row.attention.overdue > 0 ? "text-late" : "text-ink-3",
            )}
          >
            {row.attention.overdue > 0
              ? translate("crm.dashboard.deal_actions.counts.overdue", {
                  count: row.attention.overdue,
                  _: `${row.attention.overdue} te laat`,
                })
              : translate("crm.dashboard.workload.needs_action", {
                  count: row.attention.total,
                  _: `${row.attention.total} te doen`,
                })}
          </span>
        ) : null}
      </span>
    </Link>
  );
};
