// Resend inbound-email webhook -> CRM.
//
// Resend signs webhooks with Svix and the `email.received` event carries only
// metadata (no body); the full content is fetched from the Received-emails API.
// Once normalised, the routing is identical to the Postmark path, so we reuse
// those helpers verbatim: a "deal-<id>@" recipient links straight to the deal,
// otherwise every real client in To+Cc becomes/matches a contact (with a
// forwarded-body fallback), and the note is mirrored onto active deals.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { addNoteToContact } from "../postmark/addNoteToContact.ts";
import { addNoteToDeal } from "../postmark/addNoteToDeal.ts";
import {
  extractForwardedSender,
  getForwardedMailContent,
  stripSubjectForwardingPrefix,
} from "../postmark/forwardedParser.ts";
import { extractDealIdFromEmails } from "../postmark/extractDealId.ts";
import { gatherClientParticipants } from "../postmark/gatherParticipants.ts";
import { linkMailToActiveDeals } from "../postmark/linkMailToActiveDeals.ts";
import { getNoteContent } from "../postmark/getNoteContent.ts";
import { extractDealAmount } from "../trello-sync/extractDealAmount.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractDealDates } from "./extractDealDates.ts";
import { parseEmailAddress, parseEmailContacts } from "./parseEmailAddress.ts";
import { upsertDealFromMail } from "./upsertDealFromMail.ts";
import { resolveInvolvedSalesIds } from "./resolveInvolvedSalesIds.ts";
import { verifySvixSignature } from "./verifySvixSignature.ts";
import { findCompanyMentionedInText } from "./matchCompanyInText.ts";
import { attachMailToCompanyDeal } from "./attachMailToCompanyDeal.ts";
import { htmlToText } from "./htmlToText.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
const INBOUND_EMAIL = (Deno.env.get("VITE_INBOUND_EMAIL") || "").toLowerCase();
if (!RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) {
  throw new Error(
    "Missing RESEND_API_KEY or RESEND_WEBHOOK_SECRET env variable",
  );
}

interface ResendReceivedEmail {
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
}

// The webhook is metadata-only; fetch the full email (from/to/cc/subject/body).
const fetchReceivedEmail = async (
  emailId: string,
): Promise<ResendReceivedEmail> => {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } },
  );
  if (!res.ok) {
    throw new Error(
      `Resend received-email fetch failed (${res.status}): ${await res.text()}`,
    );
  }
  return (await res.json()) as ResendReceivedEmail;
};

// Claims a Resend email_id for processing, exactly once. Returns true when THIS
// call won the claim (insert succeeded), false when the mail was already
// handled by an earlier delivery. Resend/Svix are at-least-once, so without
// this a redelivered event re-runs the whole pipeline and duplicates every
// contact/deal note. A claim error (DB hiccup) is treated as "not claimed" so
// the webhook can still 200 and Svix will redeliver later.
const claimInboundEmail = async (emailId: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("inbound_email_events")
    .insert({ email_id: emailId });
  if (!error) return true;
  // 23505 = unique_violation: already processed. Anything else is unexpected.
  if (error.code !== "23505") {
    console.error(`Could not claim inbound email ${emailId}:`, error.message);
  }
  return false;
};

// Releases a claim so a redelivery can re-attempt, used when processing fails
// BEFORE any note was written (e.g. the Resend fetch or the single deal-note
// insert failed). Never called once the participant loop has started writing:
// there, a retry would duplicate the notes that did succeed.
const releaseInboundEmail = async (emailId: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("inbound_email_events")
    .delete()
    .eq("email_id", emailId);
  if (error) {
    console.error(
      `Could not release inbound email claim ${emailId}:`,
      error.message,
    );
  }
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const rawBody = await req.text();

  // Verify the Svix signature; reject anything unsigned/forged.
  const validSignature = await verifySvixSignature({
    secret: RESEND_WEBHOOK_SECRET,
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signatureHeader: req.headers.get("svix-signature") ?? "",
    payload: rawBody,
  });
  if (!validSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Only inbound emails carry work; acknowledge every other event with a 2xx so
  // Svix does not retry it.
  if (event.type !== "email.received" || !event.data?.email_id) {
    return new Response("OK");
  }

  // Idempotency gate: claim this email_id before doing any work. A redelivery
  // (or a retry after a downstream hiccup) finds the claim already taken and
  // returns 200 without re-processing, so no duplicate notes are created.
  const emailId = event.data.email_id;
  if (!(await claimInboundEmail(emailId))) {
    return new Response("Already processed");
  }

  // Nothing has been written yet: a fetch failure must release the claim so a
  // redelivery can retry cleanly.
  let email: ResendReceivedEmail;
  try {
    email = await fetchReceivedEmail(emailId);
  } catch (error) {
    await releaseInboundEmail(emailId);
    throw error;
  }

  const senderEmail = parseEmailAddress(email.from ?? "");
  if (!senderEmail) {
    return new Response("Could not extract sender email", { status: 200 });
  }

  const toFull = parseEmailContacts(email.to);
  const ccFull = parseEmailContacts(email.cc);
  let subject = email.subject ?? "";
  let textBody =
    email.text && email.text.trim().length > 0
      ? email.text
      : htmlToText(email.html ?? "");

  // A "deal-<id>@<inbound-domain>" recipient is the most explicit route.
  const inboundDomain = INBOUND_EMAIL.split("@")[1] || "";
  const dealId = extractDealIdFromEmails(toFull, inboundDomain);
  if (dealId) {
    const dealNoteContent = getNoteContent(
      stripSubjectForwardingPrefix(subject),
      getForwardedMailContent(textBody),
    );
    const dealResponse = await addNoteToDeal({
      salesEmail: senderEmail,
      dealId,
      noteContent: dealNoteContent,
      attachments: [],
    });
    // A 5xx is transient (DB hiccup): release the claim so the redelivery can
    // retry. A 4xx (unknown/archived deal, no active sales) is deterministic —
    // keep the claim so Svix stops retrying a permanent no-op.
    if (dealResponse.status >= 500) await releaseInboundEmail(emailId);
    return dealResponse;
  }

  // Team (sales) addresses are excluded from the client set and own the note.
  const { data: salesRows } = await supabaseAdmin
    .from("sales")
    .select("id, email");
  const sales = (salesRows ?? []) as { id: number; email: string }[];
  const salesByEmail = new Map(sales.map((s) => [s.email.toLowerCase(), s.id]));
  const salesEmails = [...salesByEmail.keys()];

  const envelopeEmails = [
    senderEmail,
    ...toFull.map((t) => t.Email),
    ...ccFull.map((c) => c.Email),
  ]
    .map((email) => email.toLowerCase())
    .filter(Boolean);
  const forwarderSalesEmail =
    envelopeEmails.find((email) => salesByEmail.has(email)) ?? senderEmail;
  const forwarderSalesId = salesByEmail.get(forwarderSalesEmail);

  // Every CRM team member on the mail - envelope (From/To/Cc) or the forwarded
  // headers in the body - is an involved party. They become the deal's
  // assignees, so a card created from a mail is visible to exactly the
  // colleagues who were on the thread. The body is scanned because Resend's
  // envelope only carries recipients on the receiving domain (a partner on
  // another domain would otherwise be missed).
  const involvedSalesIds = resolveInvolvedSalesIds(
    envelopeEmails,
    textBody,
    salesByEmail,
  );

  // Smart routing: every real client in To + Cc becomes (or matches) a contact.
  let participants = gatherClientParticipants({
    recipients: [...toFull, ...ccFull],
    salesEmails,
    inboundEmail: INBOUND_EMAIL,
  });

  // Forwarded-to-inbound: the envelope holds only intake/team addresses, so the
  // real client lives in the forwarded body. Only trust it when a team member
  // is involved, and keep just the first client (the forwarded original sender).
  if (participants.length === 0) {
    if (!salesByEmail.has(forwarderSalesEmail)) {
      return new Response(
        `No team member involved; not routing mail from ${senderEmail}`,
        { status: 200 },
      );
    }
    // Prefer the forwarded block's own "From:" line: it carries the client's
    // real display name ("Jan Tester <jan@...>"), where the raw address scan
    // below can only guess a first name from the address.
    const forwardedSender = extractForwardedSender(textBody);
    const emailRegex = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
    const bodyEmails = forwardedSender
      ? [{ Email: forwardedSender.email, Name: forwardedSender.name }]
      : ((textBody.match(emailRegex) || []) as string[]).map((email) => ({
          Email: email,
          Name: "",
        }));
    participants = gatherClientParticipants({
      recipients: bodyEmails,
      salesEmails,
      inboundEmail: INBOUND_EMAIL,
    }).slice(0, 1);
    if (participants.length === 0) {
      // No client e-mail address anywhere (e.g. a team member forwards an
      // internal update that only NAMES a client). Try to recognise an
      // existing customer by name in the subject/body and file the mail on
      // that customer's deal, instead of creating a bogus company from the
      // intake/team domain.
      const strippedSubject = stripSubjectForwardingPrefix(subject);
      const forwardedContent = getForwardedMailContent(textBody);
      const { data: companyRows } = await supabaseAdmin
        .from("companies")
        .select("id, name");
      const matchedCompany = findCompanyMentionedInText(
        `${strippedSubject}\n${forwardedContent}`,
        (companyRows ?? []) as { id: number; name: string }[],
      );
      if (matchedCompany) {
        await attachMailToCompanyDeal({
          companyId: matchedCompany.id,
          subject: strippedSubject,
          noteContent: getNoteContent(strippedSubject, forwardedContent),
          salesEmail: forwarderSalesEmail,
          salesId: forwarderSalesId ?? null,
          assigneeIds: involvedSalesIds,
        });
        return new Response("OK");
      }
      return new Response(
        `Could not determine any client participant to route the mail to`,
        { status: 200 },
      );
    }
    textBody = getForwardedMailContent(textBody);
    subject = stripSubjectForwardingPrefix(subject);
  }

  const noteContent = getNoteContent(subject, textBody);

  // Intelligent extraction from the (normalised) mail: a deal value and any
  // start/delivery dates. Computed once and reused for every participant so a
  // multi-recipient mail describes the same offer consistently.
  const amount = extractDealAmount(subject, textBody);
  const dates = extractDealDates(textBody);
  // Guards the "max one deal per company per mail" invariant across participants
  // that resolve to the same company.
  const handledCompanyIds = new Set<number>();

  // The claim is now taken and the loop below starts writing notes. A retry
  // must therefore NOT re-run this mail (it would duplicate whatever already
  // succeeded), so every participant is handled best-effort and the webhook
  // always ends in a 2xx. A participant that hits a transient error is logged
  // and skipped; the others still get processed.
  let failedParticipants = 0;
  for (const {
    firstName,
    lastName,
    email: contactEmail,
    domain,
    companyName,
    website,
  } of participants) {
    try {
      const errorResponse = await addNoteToContact({
        salesEmail: forwarderSalesEmail,
        email: contactEmail,
        domain,
        firstName,
        lastName,
        noteContent,
        attachments: [],
        companyName,
        website,
      });
      if (errorResponse) {
        failedParticipants += 1;
        console.error(
          `Inbound mail ${emailId}: could not process participant ${contactEmail} (status ${errorResponse.status})`,
        );
        continue;
      }

      if (forwarderSalesId != null) {
        await linkMailToActiveDeals({
          contactEmail,
          salesId: forwarderSalesId,
          noteContent,
          attachments: [],
        });
      }

      // Open or enrich the company's deal with the extracted value/dates. Runs
      // after linkMailToActiveDeals so a freshly created deal is not
      // double-noted (that mirror only touches deals that already existed).
      // Best-effort: any failure is swallowed inside the helper.
      await upsertDealFromMail({
        contactEmail,
        subject,
        companyNameFallback: companyName,
        amount,
        startDate: dates.startDate,
        deliveryDate: dates.deliveryDate,
        salesEmail: forwarderSalesEmail,
        salesId: forwarderSalesId ?? null,
        assigneeIds: involvedSalesIds,
        noteContent,
        handledCompanyIds,
      });
    } catch (error) {
      failedParticipants += 1;
      console.error(
        `Inbound mail ${emailId}: unexpected error processing participant ${contactEmail}:`,
        error,
      );
    }
  }

  if (failedParticipants > 0) {
    console.error(
      `Inbound mail ${emailId}: ${failedParticipants}/${participants.length} participant(s) failed; not retried to avoid duplicating the ones that succeeded.`,
    );
  }
  return new Response("OK");
});
