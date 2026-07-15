export const DEFAULT_GMAIL_SYNC_BATCH_SIZE = 10;

export const gmailInboundEmailId = (
  salesId: number,
  messageId: string,
): string => `gmail:${salesId}:${messageId}`;

export interface GmailSyncBatch {
  messageIds: string[];
  alreadyHandled: number;
  remaining: number;
}

export const selectGmailSyncBatch = ({
  messageIds,
  claimedEmailIds,
  salesId,
  limit = DEFAULT_GMAIL_SYNC_BATCH_SIZE,
}: {
  messageIds: string[];
  claimedEmailIds: ReadonlySet<string>;
  salesId: number;
  limit?: number;
}): GmailSyncBatch => {
  const unhandled = messageIds.filter(
    (messageId) =>
      !claimedEmailIds.has(gmailInboundEmailId(salesId, messageId)),
  );
  const batchSize = Math.max(1, Math.floor(limit));

  return {
    messageIds: unhandled.slice(0, batchSize),
    alreadyHandled: messageIds.length - unhandled.length,
    remaining: Math.max(0, unhandled.length - batchSize),
  };
};
