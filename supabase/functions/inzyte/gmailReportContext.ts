import {
  getGmailAttachmentData,
  getGmailMessage,
  refreshGmailAccessToken,
  searchGmailMessageIds,
} from "../_shared/gmail/client.ts";
import { normalizeGmailMessage } from "../_shared/gmail/messageParser.ts";
import {
  decryptGmailToken,
  gmailConnectionAad,
} from "../_shared/gmail/tokenCrypto.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { MonthlyReportPeriod } from "./monthlyReport.ts";
import type { ReportEvidenceBundle, SentMailInput } from "./reportEvidence.ts";
import {
  buildSentMailSearchQuery,
  isRelevantReportMessage,
} from "./gmailReportQuery.ts";

type DealMailContext = {
  name?: unknown;
  description?: unknown;
  created_at?: unknown;
  category?: unknown;
  companies?: unknown;
};

export type SentGmailContext = {
  status: ReportEvidenceBundle["gmailStatus"];
  messages: SentMailInput[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const messageDate = (internalDate: string | undefined): string =>
  internalDate && Number.isFinite(Number(internalDate))
    ? new Date(Number(internalDate)).toISOString()
    : new Date().toISOString();

const mapWithConcurrency = async <Input, Output>(
  items: Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
): Promise<Output[]> => {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;
  const processNext = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    results[index] = await mapper(items[index], index);
    await processNext();
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      processNext(),
    ),
  );
  return results;
};

export const loadSentGmailContext = async ({
  saleId,
  deal,
  period,
}: {
  saleId: number;
  deal: DealMailContext;
  period: MonthlyReportPeriod;
}): Promise<SentGmailContext> => {
  const { data: connection, error } = await supabaseAdmin
    .from("gmail_connections")
    .select("refresh_token_encrypted")
    .eq("sales_id", saleId)
    .maybeSingle();
  if (error || !connection?.refresh_token_encrypted) {
    return { status: error ? "failed" : "not_connected", messages: [] };
  }

  const company = Array.isArray(deal.companies)
    ? deal.companies[0]
    : deal.companies;
  const companyRecord = isRecord(company) ? company : {};
  const query = buildSentMailSearchQuery({
    companyName: text(companyRecord.name),
    dealName: text(deal.name),
    website: text(companyRecord.website),
    createdAt: text(deal.created_at),
    period,
  });
  if (!query) return { status: "no_match", messages: [] };

  const encKey = Deno.env.get("GMAIL_ENC_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!encKey || !clientId || !clientSecret) {
    return { status: "failed", messages: [] };
  }

  try {
    const refreshToken = await decryptGmailToken(
      String(connection.refresh_token_encrypted),
      encKey,
      gmailConnectionAad(saleId),
    );
    const accessToken = await refreshGmailAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    });
    const ids = await searchGmailMessageIds(accessToken, query, 40);
    // Four workers keep Gmail latency low without releasing all requests at
    // once. The result array retains the search order.
    const messages = (
      await mapWithConcurrency<string, SentMailInput | null>(
        ids,
        4,
        async (messageId) => {
          const message = await getGmailMessage(accessToken, messageId);
          if (!(message.labelIds || []).some((labelId) => labelId === "SENT")) {
            return null;
          }
          const normalized = await normalizeGmailMessage(
            message,
            (attachmentId) =>
              getGmailAttachmentData(accessToken, messageId, attachmentId),
          );
          const body = text(normalized.text) || text(normalized.html);
          const subject = text(normalized.subject);
          if (!isRelevantReportMessage({ subject, body })) return null;
          return {
            id: messageId,
            subject,
            date: messageDate(message.internalDate),
            text: body.slice(0, 12_000),
          };
        },
      )
    ).filter((message): message is SentMailInput => message !== null);
    return {
      status: messages.length > 0 ? "connected" : "no_match",
      messages,
    };
  } catch {
    // A report remains usable without correspondence; do not expose mailbox
    // details or Google errors in the customer-facing result.
    return { status: "failed", messages: [] };
  }
};
