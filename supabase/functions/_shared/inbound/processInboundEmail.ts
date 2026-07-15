// Provider-independent inbound mail routing.
//
// Resend webhooks and Gmail API synchronization both normalize their message
// into this shape and then use the exact same CRM behavior: idempotency,
// explicit deal routing, contact/company matching, note creation and deal
// enrichment. Provider message ids are namespaced by the caller.

import { addNoteToContact } from "../../postmark/addNoteToContact.ts";
import { addNoteToDeal } from "../../postmark/addNoteToDeal.ts";
import {
  extractForwardedSender,
  getForwardedMailContent,
  stripSubjectForwardingPrefix,
} from "../../postmark/forwardedParser.ts";
import { extractDealIdFromEmails } from "../../postmark/extractDealId.ts";
import { gatherClientParticipants } from "../../postmark/gatherParticipants.ts";
import { getNoteContent } from "../../postmark/getNoteContent.ts";
import { linkMailToActiveDeals } from "../../postmark/linkMailToActiveDeals.ts";
import { extractDealAmount } from "../../trello-sync/extractDealAmount.ts";
import { supabaseAdmin } from "../supabaseAdmin.ts";
import { attachMailToCompanyDeal } from "../../resend_inbound/attachMailToCompanyDeal.ts";
import { extractDealDates } from "../../resend_inbound/extractDealDates.ts";
import { htmlToText } from "../../resend_inbound/htmlToText.ts";
import { findCompanyMentionedInText } from "../../resend_inbound/matchCompanyInText.ts";
import {
  parseEmailAddress,
  parseEmailContacts,
} from "../../resend_inbound/parseEmailAddress.ts";
import { resolveInvolvedSalesIds } from "../../resend_inbound/resolveInvolvedSalesIds.ts";
import { upsertDealFromMail } from "../../resend_inbound/upsertDealFromMail.ts";

export interface NormalizedInboundEmail {
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
}

export interface ProcessInboundEmailOptions {
  /** A provider-namespaced, globally unique idempotency key. */
  emailId: string;
  email: NormalizedInboundEmail;
  inboundEmail?: string;
  /** Gmail owner used when the connected mailbox differs from the CRM login. */
  ownerSalesId?: number;
  ownerSalesEmail?: string;
  /** Excluded from client matching even when it is not a CRM login address. */
  mailboxEmail?: string;
}

const claimInboundEmail = async (emailId: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("inbound_email_events")
    .insert({ email_id: emailId });
  if (!error) return true;
  if (error.code !== "23505") {
    console.error(`Could not claim inbound email ${emailId}:`, error.message);
  }
  return false;
};

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

export const processInboundEmail = async ({
  emailId,
  email,
  inboundEmail = "",
  ownerSalesId,
  ownerSalesEmail,
  mailboxEmail,
}: ProcessInboundEmailOptions): Promise<Response> => {
  if (!(await claimInboundEmail(emailId))) {
    return new Response("Already processed");
  }

  const senderEmail = parseEmailAddress(email.from ?? "");
  if (!senderEmail) {
    return new Response("Could not extract sender email", { status: 200 });
  }

  const fromFull = parseEmailContacts(email.from ? [email.from] : []);
  const toFull = parseEmailContacts(email.to);
  const ccFull = parseEmailContacts(email.cc);
  let subject = email.subject ?? "";
  let textBody =
    email.text && email.text.trim().length > 0
      ? email.text
      : htmlToText(email.html ?? "");

  const normalizedInboundEmail = inboundEmail.toLowerCase();
  const inboundDomain = normalizedInboundEmail.split("@")[1] || "";
  const dealId = extractDealIdFromEmails(toFull, inboundDomain);
  if (dealId) {
    const dealNoteContent = getNoteContent(
      stripSubjectForwardingPrefix(subject),
      getForwardedMailContent(textBody),
    );
    const dealResponse = await addNoteToDeal({
      salesEmail: ownerSalesEmail ?? senderEmail,
      dealId,
      noteContent: dealNoteContent,
      attachments: [],
    });
    if (dealResponse.status >= 500) await releaseInboundEmail(emailId);
    return dealResponse;
  }

  const { data: salesRows } = await supabaseAdmin
    .from("sales")
    .select("id, email");
  const sales = (salesRows ?? []) as { id: number; email: string }[];
  const salesByEmail = new Map(sales.map((s) => [s.email.toLowerCase(), s.id]));
  const excludedEmails = new Set(salesByEmail.keys());
  if (mailboxEmail) excludedEmails.add(mailboxEmail.toLowerCase());

  const envelopeEmails = [
    senderEmail,
    ...toFull.map((recipient) => recipient.Email),
    ...ccFull.map((recipient) => recipient.Email),
  ]
    .map((address) => address.toLowerCase())
    .filter(Boolean);

  const envelopeSalesEmail = envelopeEmails.find((address) =>
    salesByEmail.has(address),
  );
  const forwarderSalesEmail =
    envelopeSalesEmail ?? ownerSalesEmail?.toLowerCase() ?? senderEmail;
  const forwarderSalesId =
    (envelopeSalesEmail ? salesByEmail.get(envelopeSalesEmail) : undefined) ??
    ownerSalesId ??
    salesByEmail.get(forwarderSalesEmail);

  const involvedSalesIds = resolveInvolvedSalesIds(
    envelopeEmails,
    textBody,
    salesByEmail,
  );
  if (ownerSalesId != null && !involvedSalesIds.includes(ownerSalesId)) {
    involvedSalesIds.push(ownerSalesId);
  }

  // Gmail delivers the actual client in From on inbound messages, while the
  // legacy forward/BCC path usually finds clients in To/Cc. Consider all three
  // headers and exclude every CRM/mailbox address.
  let participants = gatherClientParticipants({
    recipients: [...fromFull, ...toFull, ...ccFull],
    salesEmails: [...excludedEmails],
    inboundEmail: normalizedInboundEmail,
  });

  if (participants.length === 0) {
    if (forwarderSalesId == null) {
      return new Response(
        `No team member involved; not routing mail from ${senderEmail}`,
        { status: 200 },
      );
    }
    const forwardedSender = extractForwardedSender(textBody);
    const emailRegex = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
    const bodyEmails = forwardedSender
      ? [{ Email: forwardedSender.email, Name: forwardedSender.name }]
      : ((textBody.match(emailRegex) || []) as string[]).map((address) => ({
          Email: address,
          Name: "",
        }));
    participants = gatherClientParticipants({
      recipients: bodyEmails,
      salesEmails: [...excludedEmails],
      inboundEmail: normalizedInboundEmail,
    }).slice(0, 1);
    if (participants.length === 0) {
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
        "Could not determine any client participant to route the mail to",
        { status: 200 },
      );
    }
    textBody = getForwardedMailContent(textBody);
    subject = stripSubjectForwardingPrefix(subject);
  }

  const noteContent = getNoteContent(subject, textBody);
  const amount = extractDealAmount(subject, textBody);
  const dates = extractDealDates(textBody);
  const handledCompanyIds = new Set<number>();

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
        `Inbound mail ${emailId}: unexpected participant error for ${contactEmail}:`,
        error,
      );
    }
  }

  if (failedParticipants > 0) {
    console.error(
      `Inbound mail ${emailId}: ${failedParticipants}/${participants.length} participant(s) failed; not retried to avoid duplicate notes.`,
    );
  }
  return new Response("OK");
};
