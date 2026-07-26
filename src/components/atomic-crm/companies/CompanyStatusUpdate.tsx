import {
  useGetIdentity,
  useGetList,
  useGetMany,
  useRecordContext,
} from "ra-core";
import { useMemo, useState } from "react";

import { StatusUpdateComposer } from "../deals/StatusUpdateComposer";
import {
  buildCompanyStatusUpdate,
  type StatusUpdateVariant,
} from "../deals/statusUpdateModel";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { isAutomaticTask } from "../tasks/taskSource";
import type { Company, Contact, Deal, Task } from "../types";

/** Finished work does not need explaining; on-hold work needs it most. */
const isLive = (deal: Deal) =>
  deal.archived_at == null && deal.stage !== "won" && deal.stage !== "lost";

const firstEmail = (contacts: Contact[]): string | undefined => {
  for (const contact of contacts) {
    const email = contact.email_jsonb?.find((entry) => entry.email)?.email;
    if (email) return email;
  }
  return undefined;
};

/**
 * One update for everything that runs for this client.
 *
 * Hunting XL has four open assignments. Four separate updates about one
 * relationship read as four unrelated projects and take four times as long, so
 * this bundles them: one greeting, one sign-off, a block per assignment. Sharing
 * it records the update on every assignment it speaks for, so no single one of
 * them can still look neglected afterwards.
 */
export const CompanyStatusUpdate = () => {
  const record = useRecordContext<Company>();
  const { dealStages } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const [variant, setVariant] = useState<StatusUpdateVariant>("full");

  const { data: deals = [] } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { company_id: record?.id, "archived_at@is": null },
    },
    { enabled: record?.id != null },
  );
  const liveDeals = useMemo(() => deals.filter(isLive), [deals]);

  const { data: steps = [] } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        "deal_id@in": `(${liveDeals.map((deal) => deal.id).join(",")})`,
      },
    },
    { enabled: liveDeals.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: liveDeals.flatMap((deal) => (deal.contact_ids ?? []) as number[]) },
    { enabled: liveDeals.some((deal) => (deal.contact_ids?.length ?? 0) > 0) },
  );

  const senderName = identity?.fullName ?? undefined;
  const companyName = record?.name ?? "";

  const composed = useMemo(() => {
    if (!record || liveDeals.length === 0) return null;
    return buildCompanyStatusUpdate({
      companyName,
      deals: liveDeals.map((deal) => ({
        deal,
        steps: steps.filter(
          (step) =>
            String(step.deal_id) === String(deal.id) && !isAutomaticTask(step),
        ),
      })),
      now: new Date(),
      senderName,
      stages: dealStages,
      variant,
    });
  }, [companyName, dealStages, liveDeals, record, senderName, steps, variant]);

  if (!record || !composed || liveDeals.length === 0) return null;

  // The oldest silence in the bundle is the one that matters: an update is due
  // as soon as any of this client's work has gone quiet.
  const lastSharedAt = liveDeals.every((deal) => deal.client_updated_at)
    ? liveDeals
        .map((deal) => deal.client_updated_at as string)
        .sort()
        .at(0)
    : null;

  return (
    <StatusUpdateComposer
      anchorDealId={liveDeals[0].id}
      companyId={record.id}
      companyName={companyName}
      composed={composed}
      heading={
        liveDeals.length > 1
          ? `Statusupdate over ${liveDeals.length} opdrachten`
          : "Statusupdate voor de klant"
      }
      lastSharedAt={lastSharedAt}
      logDealIds={liveDeals.map((deal) => deal.id)}
      onVariantChange={setVariant}
      recipient={firstEmail(contacts)}
      scope="company"
      senderName={senderName}
      variant={variant}
    />
  );
};
