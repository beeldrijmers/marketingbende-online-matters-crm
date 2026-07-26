/**
 * What gets written to gmail_connections after someone returns from Google.
 *
 * A first connection deliberately imports nothing until the owner picks a Gmail
 * label. Re-consenting the SAME mailbox is a different event: it happens when a
 * scope is added (the calendar), and resetting the label there would switch the
 * mail import off without saying so — the label, the sync state and the history
 * cursor therefore survive it. A different address is a different mailbox and
 * does start from scratch.
 */

export type ExistingGmailConnection = {
  email: string | null;
  sync_label_id: string | null;
  sync_label_name: string | null;
  sync_status: string | null;
  history_id: string | null;
  last_synced_at: string | null;
} | null;

export type GmailConnectionFields = {
  email: string;
  refresh_token_encrypted: string;
  history_id: string | null;
  sync_label_id: string | null;
  sync_label_name: string | null;
  sync_status: string;
  last_synced_at: string | null;
  last_error: null;
  updated_at: string;
};

export const connectionFieldsAfterConsent = ({
  existing,
  email,
  historyId,
  refreshTokenEncrypted,
  now,
}: {
  existing: ExistingGmailConnection;
  email: string;
  historyId: string | null;
  refreshTokenEncrypted: string;
  now: string;
}): GmailConnectionFields => {
  const address = email.toLowerCase();
  const sameMailbox =
    existing?.email != null && existing.email.toLowerCase() === address;

  if (!sameMailbox) {
    return {
      email: address,
      refresh_token_encrypted: refreshTokenEncrypted,
      history_id: historyId,
      sync_label_id: null,
      sync_label_name: null,
      sync_status: "needs_label",
      last_synced_at: null,
      last_error: null,
      updated_at: now,
    };
  }

  return {
    email: address,
    refresh_token_encrypted: refreshTokenEncrypted,
    // Keeping the old cursor means no mail falls in the gap; an expired cursor
    // is already handled by the sync (404 -> boundary reset), and a replay
    // cannot double-import because notes carry the source event id.
    history_id: existing.history_id ?? historyId,
    sync_label_id: existing.sync_label_id,
    sync_label_name: existing.sync_label_name,
    sync_status: existing.sync_label_id ? "connected" : "needs_label",
    last_synced_at: existing.last_synced_at,
    last_error: null,
    updated_at: now,
  };
};
