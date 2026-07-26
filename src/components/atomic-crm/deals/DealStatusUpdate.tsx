import {
  Check,
  Clipboard,
  FileDown,
  Mail,
  MessageSquareShare,
} from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetMany,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { isAutomaticTask } from "../tasks/taskSource";
import type { Company, Contact, Deal, Task } from "../types";
import { buildStatusUpdateDocument } from "./statusUpdateDocument";
import { buildStatusUpdate } from "./statusUpdateModel";

const DATE = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const RELATIVE = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

const daysSince = (value: string, now: number): number =>
  Math.round((now - new Date(value).getTime()) / 86_400_000);

const firstEmail = (contacts: Contact[]): string | undefined => {
  for (const contact of contacts) {
    const email = contact.email_jsonb?.find((entry) => entry.email)?.email;
    if (email) return email;
  }
  return undefined;
};

/**
 * Sending the client a status update, from the deal itself.
 *
 * The CRM knew everything an update needs — the phase, the steps that were
 * ticked off, what is next, what we are waiting for — and still every update was
 * typed from scratch in WhatsApp, which is why they were sent rarely and
 * unevenly. The text below is composed from that data, stays editable, and
 * remembers when the client was last told, so "wacht op input" can no longer
 * quietly mean "we never asked".
 */
export const DealStatusUpdate = () => {
  const record = useRecordContext<Deal>();
  const { dealStages } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");

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
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: (record?.contact_ids ?? []) as number[] },
    { enabled: (record?.contact_ids?.length ?? 0) > 0 },
  );

  const senderName = identity?.fullName ?? undefined;
  const companyName = company?.name ?? "";

  const composed = useMemo(() => {
    if (!record) return null;
    return buildStatusUpdate({
      companyName,
      deal: record,
      now: new Date(),
      senderName,
      stages: dealStages,
      // Automatic reminder rows are internal bookkeeping, never client-facing.
      steps: steps.filter((step) => !isAutomaticTask(step)),
    });
  }, [companyName, dealStages, record, senderName, steps]);

  // The composed text is a starting point, not a template to fill in: it is
  // sendable as-is, and an edit survives until the underlying facts change.
  useEffect(() => {
    if (composed) setText(composed.body);
  }, [composed]);

  if (!record || !composed) return null;

  const recipient = firstEmail(contacts);
  const lastShared = record.client_updated_at;
  const sharedLabel = lastShared
    ? RELATIVE.format(-daysSince(lastShared, Date.now()), "day")
    : null;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openPdf = () => {
    const html = buildStatusUpdateDocument({
      // Print what is on screen, including edits: two versions of one update
      // reaching the same client is worse than a plain letter.
      body: text,
      companyName,
      dateLabel: DATE.format(new Date()),
      subject: composed.subject,
    });
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const openMail = () => {
    const query = new URLSearchParams({
      subject: composed.subject,
      body: text,
    });
    window.location.href = `mailto:${recipient ?? ""}?${query.toString().replace(/\+/g, "%20")}`;
  };

  const markShared = () => {
    // `== null`, not falsy: a sales id of 0 is a valid user (the demo data set
    // starts at 0), and `!identity.id` silently did nothing for them.
    if (identity?.id == null) return;
    create(
      "deal_notes",
      {
        data: {
          deal_id: record.id,
          text: `Statusupdate gedeeld met de klant:\n\n${text}`,
          date: new Date().toISOString(),
          sales_id: identity.id,
        },
      },
      {
        onError: () =>
          notify("Statusupdate kon niet worden vastgelegd", { type: "error" }),
        onSuccess: () => {
          update(
            "deals",
            {
              id: record.id,
              data: { client_updated_at: new Date().toISOString() },
              previousData: record,
            },
            {
              onSettled: () => refresh(),
            },
          );
          notify("Statusupdate vastgelegd bij de opdracht", {
            type: "success",
          });
        },
      },
    );
  };

  return (
    <section className="panel flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-section text-ink">Statusupdate voor de klant</h3>
        <p className="text-meta text-ink-3">
          {sharedLabel
            ? `Laatst gedeeld ${sharedLabel}`
            : "Nog niet eerder gedeeld"}
          {composed.completedSinceLastUpdate > 0
            ? ` · ${composed.completedSinceLastUpdate} afgerond sindsdien`
            : ""}
        </p>
      </div>

      <Textarea
        aria-label="Statusupdate voor de klant"
        className="min-h-52 text-body leading-6"
        onChange={(event) => setText(event.target.value)}
        value={text}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy} size="sm" type="button" variant="outline">
          {copied ? (
            <Check className="size-4 text-live" />
          ) : (
            <Clipboard className="size-4" />
          )}
          {copied ? "Gekopieerd" : "Kopiëren"}
        </Button>
        <Button onClick={openMail} size="sm" type="button" variant="outline">
          <Mail className="size-4" />
          {recipient ? "Mail opstellen" : "Mail opstellen (geen adres)"}
        </Button>
        <Button onClick={openPdf} size="sm" type="button" variant="outline">
          <FileDown className="size-4" />
          PDF
        </Button>
        <Button
          className="ml-auto"
          onClick={markShared}
          size="sm"
          type="button"
        >
          <MessageSquareShare className="size-4" />
          Gedeeld
        </Button>
      </div>
    </section>
  );
};
