import {
  useGetList,
  useGetIdentity,
  useGetMany,
  useGetOne,
  useRecordContext,
} from "ra-core";
import { useMemo, useState } from "react";

import { isAutomaticTask } from "../tasks/taskSource";
import type { Company, Contact, Deal, Sale, Task } from "../types";
import { StatusUpdateComposer } from "./StatusUpdateComposer";
import {
  buildStatusUpdate,
  selectStatusUpdateResults,
  type StatusUpdateVariant,
} from "./statusUpdateModel";
import { resolveCorrespondence } from "../companies/correspondence";

/**
 * The status update for one assignment.
 *
 * The CRM knew everything an update needs — the phase, the steps that were
 * ticked off, what is next, what we are waiting for — and still every update was
 * typed from scratch in WhatsApp, which is why they went out rarely and
 * unevenly. This composes it from that data; the composer below handles getting
 * it to the client.
 */
export const DealStatusUpdate = () => {
  const record = useRecordContext<Deal>();
  const { identity } = useGetIdentity();
  const [variant, setVariant] = useState<StatusUpdateVariant>("full");

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record?.company_id as number },
    { enabled: record?.company_id != null },
  );
  const { data: steps = [] } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "due_date", order: "ASC" },
      filter: { deal_id: record?.id },
    },
    { enabled: record?.id != null },
  );
  // Names of the team, so a step naming a colleague can be kept out of the
  // client's text (see clientSafeText).
  const { data: team = [] } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
    filter: {},
  });
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: (record?.contact_ids ?? []) as number[] },
    { enabled: (record?.contact_ids?.length ?? 0) > 0 },
  );

  const companyName = company?.name ?? "";
  // Loopt de klant via een partner, dan gaat de update naar die partner. Hun
  // eindklant aanschrijven gaat over het hoofd van de partner heen.
  const correspondence = resolveCorrespondence({
    contacts,
    correspondenceEmail: company?.correspondence_email,
  });
  const senderName = identity?.fullName ?? undefined;

  const composed = useMemo(() => {
    if (!record) return null;
    return buildStatusUpdate({
      companyName,
      deal: record,
      now: new Date(),
      senderName,
      // Search Console / GA4 figures when the assignment has a connection and a
      // report for the month being told about.
      results: selectStatusUpdateResults(record.latest_seo_report, new Date()),
      // Automatic reminder rows are internal bookkeeping, never client-facing.
      steps: steps.filter((step) => !isAutomaticTask(step)),
      teamNames: team.map((sale) =>
        `${sale.first_name ?? ""} ${sale.last_name ?? ""}`.trim(),
      ),
      variant,
    });
  }, [companyName, record, senderName, steps, team, variant]);

  if (!record || !composed) return null;

  return (
    <StatusUpdateComposer
      anchorDealId={record.id}
      companyId={record.company_id}
      companyName={companyName}
      composed={composed}
      heading="Statusupdate voor de klant"
      lastSharedAt={record.client_updated_at}
      logDealIds={[record.id]}
      onVariantChange={setVariant}
      recipient={correspondence.email}
      recipientWarning={correspondence.waarschuwing}
      scope="deal"
      senderName={senderName}
      variant={variant}
    />
  );
};
