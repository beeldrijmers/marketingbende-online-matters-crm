// Resend inbound-email webhook -> provider-independent CRM mail processor.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  type NormalizedInboundEmail,
  processInboundEmail,
} from "../_shared/inbound/processInboundEmail.ts";
import { verifySvixSignature } from "./verifySvixSignature.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
const INBOUND_EMAIL = (Deno.env.get("VITE_INBOUND_EMAIL") || "").toLowerCase();

if (!RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) {
  throw new Error(
    "Missing RESEND_API_KEY or RESEND_WEBHOOK_SECRET env variable",
  );
}

const fetchReceivedEmail = async (
  emailId: string,
): Promise<NormalizedInboundEmail> => {
  const response = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } },
  );
  if (!response.ok) {
    throw new Error(
      `Resend received-email fetch failed (${response.status}): ${await response.text()}`,
    );
  }
  return (await response.json()) as NormalizedInboundEmail;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const rawBody = await req.text();
  const validSignature = await verifySvixSignature({
    secret: RESEND_WEBHOOK_SECRET,
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signatureHeader: req.headers.get("svix-signature") ?? "",
    payload: rawBody,
  });
  if (!validSignature)
    return new Response("Invalid signature", { status: 401 });

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (event.type !== "email.received" || !event.data?.email_id) {
    return new Response("OK");
  }

  const emailId = event.data.email_id;
  // Fetching before claiming is safe: all writes remain behind the shared
  // processor's idempotency gate, while a provider outage stays retryable.
  const email = await fetchReceivedEmail(emailId);
  return processInboundEmail({
    // Keep the legacy raw Resend id so already-processed production messages
    // remain deduplicated after this refactor.
    emailId,
    email,
    inboundEmail: INBOUND_EMAIL,
  });
});
