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
  selectStatusUpdateResults,
  type StatusUpdateVariant,
} from "../deals/statusUpdateModel";
import { isAutomaticTask } from "../tasks/taskSource";
import type { Company, Contact, Deal, Sale, Task } from "../types";
import { resolveCorrespondence } from "./correspondence";

/**
 * Finished work does not need explaining; on-hold work needs it most. Internal
 * work is not the client's at all: a bundle for a client who also appears on a
 * Happr or own-project card would have handed them our own project names.
 */
const isLive = (deal: Deal) =>
  deal.archived_at == null &&
  deal.stage !== "won" &&
  deal.stage !== "lost" &&
  deal.is_internal !== true;

/**
 * Waarover je een klant iets kunt vertellen, ook als er niets meer loopt.
 *
 * Zonder lopend werk verdween dit blok helemaal, en dan kon je een klant bij wie
 * alles is opgeleverd niets meer sturen. "Waar staan we nu" is juist dan een
 * eerlijke vraag: het antwoord is dat het af is. Niet doorgegaan werk blijft
 * eruit, en intern werk is niet van de klant.
 */
const isReportable = (deal: Deal) =>
  deal.stage !== "lost" && deal.is_internal !== true;

/** Hoeveel afgeronde opdrachten er hoogstens in zo'n terugblik gaan. */
const MAX_AFGEROND = 3;

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
  const liveDeals = useMemo(() => {
    const lopend = deals.filter(isLive);
    if (lopend.length > 0) return lopend;
    // Niets loopt: val terug op het recentst afgeronde werk, zodat er altijd een
    // update te sturen is.
    return [...deals]
      .filter(isReportable)
      .sort((links, rechts) =>
        String(rechts.updated_at ?? rechts.created_at ?? "").localeCompare(
          String(links.updated_at ?? links.created_at ?? ""),
        ),
      )
      .slice(0, MAX_AFGEROND);
  }, [deals]);

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
  const { data: team = [] } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
    filter: {},
  });
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: liveDeals.flatMap((deal) => (deal.contact_ids ?? []) as number[]) },
    { enabled: liveDeals.some((deal) => (deal.contact_ids?.length ?? 0) > 0) },
  );

  const senderName = identity?.fullName ?? undefined;
  const companyName = record?.name ?? "";
  // Loopt deze klant via een partner, dan gaat de update naar die partner.
  const correspondence = resolveCorrespondence({
    contacts,
    correspondenceEmail: record?.correspondence_email,
  });

  const composed = useMemo(() => {
    if (!record || liveDeals.length === 0) return null;
    return buildCompanyStatusUpdate({
      companyName,
      deals: liveDeals.map((deal) => ({
        deal,
        results: selectStatusUpdateResults(deal.latest_seo_report, new Date()),
        steps: steps.filter(
          (step) =>
            String(step.deal_id) === String(deal.id) && !isAutomaticTask(step),
        ),
      })),
      now: new Date(),
      senderName,
      teamNames: team.map((sale) =>
        `${sale.first_name ?? ""} ${sale.last_name ?? ""}`.trim(),
      ),
      variant,
    });
  }, [companyName, liveDeals, record, senderName, steps, team, variant]);

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
      recipient={correspondence.email}
      recipientWarning={correspondence.waarschuwing}
      scope="company"
      senderName={senderName}
      variant={variant}
    />
  );
};
