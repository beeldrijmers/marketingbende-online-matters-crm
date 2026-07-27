import {
  Check,
  Clipboard,
  Eye,
  FileDown,
  Link2,
  Link2Off,
  Mail,
  MessageSquareShare,
  TriangleAlert,
} from "lucide-react";
import type { Identifier } from "ra-core";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { DealStatusUpdate as SharedStatusUpdate } from "../types";
import { buildStatusUpdateDocument } from "./statusUpdateDocument";
import type { StatusUpdate, StatusUpdateVariant } from "./statusUpdateModel";
import { createStatusToken, statusUpdateUrl } from "./statusUpdateToken";

const DATE = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_DATE = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

const RELATIVE = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

/** A missing or malformed date must not take a whole list down with it. */
const formatDay = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : SHORT_DATE.format(date);
};

const daysSince = (value: string, now: number): number =>
  Math.round((now - new Date(value).getTime()) / 86_400_000);

const VARIANTS: { value: StatusUpdateVariant; label: string; hint: string }[] =
  [
    { value: "full", label: "Volledig", hint: "Voor mail, PDF of een link" },
    { value: "short", label: "Kort", hint: "Vier regels voor WhatsApp" },
  ];

/**
 * Getting a status update out of the CRM and to the client.
 *
 * Shared by the assignment page and the client page: the text is composed
 * elsewhere (per assignment or bundled per client), and everything that happens
 * to it afterwards — editing, copying, mailing, printing, sharing as a link,
 * recording that it went out — is the same job and lives here once.
 */
export const StatusUpdateComposer = ({
  anchorDealId,
  companyId,
  companyName,
  composed,
  heading,
  lastSharedAt,
  logDealIds,
  recipient,
  recipientWarning,
  scope,
  senderName,
  variant,
  onVariantChange,
}: {
  /** The assignment a shared link and its history hang off. */
  anchorDealId: Identifier;
  companyId?: Identifier | null;
  companyName: string;
  composed: StatusUpdate;
  heading: string;
  lastSharedAt?: string | null;
  /** Every assignment this update speaks for: each gets the note and the stamp. */
  logDealIds: Identifier[];
  recipient?: string;
  /** Waarom dit adres afwijkt van de klant zelf, als het werk via een partner loopt. */
  recipientWarning?: string;
  scope: "deal" | "company";
  senderName?: string;
  variant: StatusUpdateVariant;
  onVariantChange: (variant: StatusUpdateVariant) => void;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [text, setText] = useState(composed.body);
  const [sharing, setSharing] = useState(false);

  const { data: shared = [], refetch: refetchShared } =
    useGetList<SharedStatusUpdate>(
      "deal_status_updates",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "shared_at", order: "DESC" },
        filter: { deal_id: anchorDealId },
      },
      { enabled: anchorDealId != null },
    );

  // The composed text is a starting point, not a template to fill in: it is
  // sendable as-is, and an edit survives until the facts or the variant change.
  useEffect(() => {
    setText(composed.body);
  }, [composed.body]);

  const sharedLabel = lastSharedAt
    ? RELATIVE.format(-daysSince(lastSharedAt, Date.now()), "day")
    : null;
  const liveLinks = shared.filter((link) => !link.revoked_at);

  const copyToClipboard = async (value: string, what: "text" | "link") => {
    // The clipboard API rejects on a blocked permission or a non-secure context,
    // and an unhandled rejection would leave the button looking broken with no
    // hint about what to do instead.
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      notify(
        what === "link"
          ? `Kopiëren lukte niet. De link is: ${value}`
          : "Kopiëren lukte niet; selecteer de tekst en kopieer handmatig",
        { type: "warning", autoHideDuration: 12_000 },
      );
    }
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

  /**
   * Browsers and mail clients cut a mailto: URL off somewhere around 2000
   * characters, which a bundled update for a client with several assignments
   * passes easily — the mail then opened half-written or empty. Past that point
   * the text goes to the clipboard and the mail opens with the subject only.
   */
  const MAILTO_LIMIT = 1600;

  const openMail = async () => {
    const tooLong = text.length > MAILTO_LIMIT;
    if (tooLong) {
      await copyToClipboard(text, "text");
      notify(
        "De update staat op je klembord: te lang voor een mailvenster. Plak hem in de mail die nu opent.",
        { type: "info", autoHideDuration: 10_000 },
      );
    }
    const query = new URLSearchParams({
      subject: composed.subject,
      ...(tooLong ? {} : { body: text }),
    });
    window.location.href = `mailto:${recipient ?? ""}?${query
      .toString()
      .replace(/\+/g, "%20")}`;
  };

  /**
   * Record that the client was told, on every assignment this update speaks for:
   * the note keeps the wording, the stamp answers "does the client know".
   */
  const record = (onDone?: () => void) => {
    // `== null`, not falsy: a sales id of 0 is a valid user (the demo data set
    // starts at 0), and `!identity.id` silently did nothing for them.
    if (identity?.id == null) return;
    const sharedAt = new Date().toISOString();
    let failed = false;

    for (const dealId of logDealIds) {
      create(
        "deal_notes",
        {
          data: {
            deal_id: dealId,
            text: `Statusupdate gedeeld met de klant:\n\n${text}`,
            date: sharedAt,
            sales_id: identity.id,
          },
        },
        {
          onError: () => {
            if (failed) return;
            failed = true;
            notify("Statusupdate kon niet worden vastgelegd", {
              type: "error",
            });
          },
        },
      );
      update(
        "deals",
        { id: dealId, data: { client_updated_at: sharedAt } },
        { onSettled: () => refresh() },
      );
    }
    onDone?.();
  };

  const markShared = () =>
    record(() =>
      notify(
        logDealIds.length > 1
          ? `Vastgelegd bij ${logDealIds.length} opdrachten`
          : "Statusupdate vastgelegd bij de opdracht",
        { type: "success" },
      ),
    );

  /**
   * A link is a delivery, not a draft: it snapshots the text, records who shared
   * it and stamps the work in one go — so the client's page keeps saying what it
   * said even after the work moves on.
   */
  const shareLink = () => {
    if (identity?.id == null || sharing) return;
    setSharing(true);
    const token = createStatusToken();
    create(
      "deal_status_updates",
      {
        data: {
          deal_id: anchorDealId,
          company_id: companyId ?? null,
          token,
          scope,
          title: composed.subject,
          body: text,
          // The blocks are the composed text, rendered. The client's page gives
          // them priority over the body, so shipping them alongside an edited
          // body would publish the sentence the sender just deleted — the one
          // human check in this whole path, undone. An empty list makes that page
          // render the text as sent. Same for the short variant: its body is four
          // chat lines while these blocks are the full letter.
          sections:
            variant === "full" && text === composed.body
              ? composed.sections
              : [],
          company_name: companyName,
          sender_name: senderName ?? null,
          shared_by: identity.id,
          // Written explicitly rather than left to the column default: the record
          // that comes straight back from the create is what the list below
          // renders, and a row without a date crashed that list.
          shared_at: new Date().toISOString(),
        },
      },
      {
        onSettled: () => setSharing(false),
        onError: () =>
          notify("De link kon niet worden aangemaakt", { type: "error" }),
        onSuccess: async () => {
          await copyToClipboard(statusUpdateUrl(token), "link");
          record();
          refetchShared();
          notify("Link gekopieerd en vastgelegd", { type: "success" });
        },
      },
    );
  };

  const revokeLink = (link: SharedStatusUpdate) => {
    update(
      "deal_status_updates",
      {
        id: link.id,
        data: { revoked_at: new Date().toISOString() },
        previousData: link,
      },
      {
        onError: () =>
          notify("De link kon niet worden ingetrokken", { type: "error" }),
        onSuccess: () => {
          refetchShared();
          notify("Link ingetrokken", { type: "info" });
        },
      },
    );
  };

  return (
    <section className="panel flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-section text-ink">{heading}</h3>
        <p className="text-meta text-ink-3">
          {sharedLabel
            ? `Laatst gedeeld ${sharedLabel}`
            : "Nog niet eerder gedeeld"}
          {composed.completedSinceLastUpdate > 0
            ? ` · ${composed.completedSinceLastUpdate} afgerond sindsdien`
            : ""}
        </p>
      </div>

      {/* One choice, so one radiogroup: as two toggle buttons a screen reader
          announced two unrelated on/off controls and it cost two tab stops. */}
      <div
        aria-label="Lengte van de update"
        className="flex w-fit items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5"
        role="radiogroup"
      >
        {VARIANTS.map((option) => (
          <button
            aria-checked={variant === option.value}
            role="radio"
            tabIndex={variant === option.value ? 0 : -1}
            className={cn(
              "flex h-7 items-center rounded-sm px-3 text-meta font-medium transition-colors duration-1",
              // The active half needs a visible edge: on the sunken group a bare
              // background change was almost invisible against the inactive half.
              variant === option.value
                ? "border border-line-strong bg-raised-hi text-ink shadow-e1"
                : "border border-transparent text-ink-3 hover:text-ink",
            )}
            key={option.value}
            onClick={() => onVariantChange(option.value)}
            title={option.hint}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <Textarea
        aria-label={heading}
        className={cn(
          "text-body leading-6",
          variant === "short" ? "min-h-28" : "min-h-52",
        )}
        onChange={(event) => setText(event.target.value)}
        value={text}
      />

      {/* Two groups instead of one wrapping row: the ways to take the text out,
          and the one action that records it. ml-auto on a wrapping flex put
          "Gedeeld" alone on a second line, right-aligned under nothing. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void copyToClipboard(text, "text")}
            size="sm"
            type="button"
            variant="outline"
          >
            {copied === "text" ? (
              <Check className="size-4 text-live" />
            ) : (
              <Clipboard className="size-4" />
            )}
            {copied === "text" ? "Gekopieerd" : "Kopiëren"}
          </Button>
          <Button
            disabled={!recipient}
            onClick={openMail}
            size="sm"
            title={
              recipient
                ? [`Mail aan ${recipient}`, recipientWarning]
                    .filter(Boolean)
                    .join(". ")
                : "Deze opdracht heeft nog geen contact met e-mailadres"
            }
            type="button"
            variant="outline"
          >
            <Mail className="size-4" />
            Mail
          </Button>
          <Button onClick={openPdf} size="sm" type="button" variant="outline">
            <FileDown className="size-4" />
            PDF
          </Button>
          <Button
            disabled={sharing}
            onClick={shareLink}
            size="sm"
            type="button"
            variant="outline"
          >
            {copied === "link" ? (
              <Check className="size-4 text-live" />
            ) : (
              <Link2 className="size-4" />
            )}
            {copied === "link" ? "Link gekopieerd" : "Deel als link"}
          </Button>
        </div>
        <Button onClick={markShared} size="sm" type="button">
          <MessageSquareShare className="size-4" />
          Gedeeld
        </Button>
      </div>
      {/* Zichtbaar, niet alleen in een tooltip: wie hier per ongeluk de eindklant
          aanschrijft gaat over het hoofd van de partner heen, en dat merk je pas
          als het al verstuurd is. */}
      {recipientWarning ? (
        <p className="flex items-start gap-1.5 text-meta text-wait">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {recipientWarning}
        </p>
      ) : null}

      {liveLinks.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-line-subtle pt-2.5">
          {liveLinks.map((link) => (
            <li
              className="flex min-w-0 items-center gap-2 text-meta text-ink-3"
              key={link.id}
            >
              <Link2 className="size-3.5 shrink-0" />
              <span className="num shrink-0">{formatDay(link.shared_at)}</span>
              <span className="truncate">{link.title}</span>
              <span
                aria-label={`${link.view_count ?? 0} keer bekeken`}
                className="num ml-auto flex shrink-0 items-center gap-1"
                title="Aantal keer bekeken"
              >
                <Eye className="size-3.5" />
                {link.view_count ?? 0}
              </span>
              <button
                aria-label={`Link van ${formatDay(link.shared_at)} intrekken`}
                className="flex shrink-0 items-center gap-1 text-ink-3 hover:text-late"
                onClick={() => revokeLink(link)}
                title="Link intrekken"
                type="button"
              >
                <Link2Off className="size-3.5" />
                <span className="hidden sm:inline">Intrekken</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
