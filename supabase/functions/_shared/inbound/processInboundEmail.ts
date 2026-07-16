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
import {
  allowsAutomaticEntityCreation,
  type InboundMailSource,
} from "./routing.ts";

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
  /** Gmail sync is intentionally non-creating; BCC/forwarding stays explicit. */
  source?: InboundMailSource;
}

export const claimInboundEmail = async (emailId: string): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("inbound_email_events")
    .insert({ email_id: emailId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Could not claim inbound email ${emailId}: ${error.message}`);
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
  source = "explicit",
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
  const canCreateEntities = allowsAutomaticEntityCreation(source);

  if (participants.length === 0) {
    if (!canCreateEntities) {
      // A Gmail label means the user wants this mail in the CRM, not that a
      // company named in its body is a new sales opportunity. We only attach
      // labelled Gmail to known contacts and active deals below. Release the
      // idempotency claim so reapplying the label after a relationship is
      // added can intentionally try this message again.
      await releaseInboundEmail(emailId);
      return new Response("No existing contact participant to route Gmail to", {
        status: 200,
      });
    }
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
  let matchedGmailParticipants = 0;
  // Keep mutations serial: the explicit route shares handledCompanyIds and
  // can create/link the same company or deal for multiple participants.
  // Parallel writes would reintroduce duplicate-record races.
  for (const {
    firstName,
    lastName,
    email: contactEmail,
    domain,
    companyName,
    website,
  } of participants) {
    try {
      if (!canCreateEntities) {
        // Do this lookup before addNoteToContact: that helper deliberately
        // creates contacts/companies for the explicit BCC/forwarding route.
        const { data: existingContact, error: contactLookupError } =
          await supabaseAdmin
            .from("contacts")
            .select("id")
            .contains("email_jsonb", JSON.stringify([{ email: contactEmail }]))
            .maybeSingle();
        if (contactLookupError) {
          failedParticipants += 1;
          console.error(
            `Inbound mail ${emailId}: could not look up Gmail contact ${contactEmail}`,
          );
          continue;
        }
        if (!existingContact) {
          // Labelled but unrecognised mail is deliberately not turned into a
          // contact/company/deal. Reapply the label after adding the relation
          // when the user wants to import it later.
          continue;
        }
        matchedGmailParticipants += 1;
      }

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
        createIfMissing: canCreateEntities,
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

      if (!canCreateEntities) continue;

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
  if (
    !canCreateEntities &&
    matchedGmailParticipants === 0 &&
    failedParticipants === 0
  ) {
    // The history cursor moves on, but a later label remove/reapply produces a
    // fresh Gmail labelAdded event. Keeping no claim here makes that explicit
    // retry possible after the user creates or links the contact.
    await releaseInboundEmail(emailId);
  }
  return new Response("OK");
};
