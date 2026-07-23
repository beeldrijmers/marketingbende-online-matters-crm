import type { GmailMessage } from "./messageParser.ts";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const googleFetch = async <T>(url: string, accessToken: string): Promise<T> => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    // Do not include Google's body: it can contain mailbox/search details.
    throw new GoogleApiError(
      response.status,
      `Google Gmail API returned HTTP ${response.status}`,
    );
  }
  return (await response.json()) as T;
};

export const refreshGmailAccessToken = async ({
  refreshToken,
  clientId,
  clientSecret,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> => {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      `Google OAuth token refresh returned HTTP ${response.status}`,
    );
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Google returned no access token");
  return body.access_token;
};

export const getGmailProfile = (
  accessToken: string,
): Promise<{ emailAddress: string; historyId: string }> =>
  googleFetch(`${GMAIL_API}/profile`, accessToken);

export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
}

export const listGmailLabels = async (
  accessToken: string,
): Promise<GmailLabel[]> => {
  const page = await googleFetch<{ labels?: GmailLabel[] }>(
    `${GMAIL_API}/labels`,
    accessToken,
  );
  return page.labels ?? [];
};

export const listGmailHistoryMessageIds = async (
  accessToken: string,
  startHistoryId: string,
  labelId: string,
): Promise<{ ids: string[]; historyId: string }> => {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  do {
    const params = new URLSearchParams({
      startHistoryId,
      maxResults: "500",
    });
    params.set("labelId", labelId);
    // Including labelAdded means a user can apply the CRM label to an older
    // thread after activating the connection and have it imported safely.
    params.append("historyTypes", "messageAdded");
    params.append("historyTypes", "labelAdded");
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{
      history?: Array<{
        messagesAdded?: Array<{ message?: { id?: string } }>;
        labelsAdded?: Array<{ message?: { id?: string } }>;
      }>;
      historyId?: string;
      nextPageToken?: string;
    }>(`${GMAIL_API}/history?${params}`, accessToken);
    for (const event of page.history ?? []) {
      for (const addition of event.messagesAdded ?? []) {
        const messageId = addition.message?.id;
        if (messageId) ids.add(messageId);
      }
      for (const addition of event.labelsAdded ?? []) {
        const messageId = addition.message?.id;
        if (messageId) ids.add(messageId);
      }
    }
    if (page.historyId) latestHistoryId = page.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { ids: [...ids], historyId: latestHistoryId };
};

export const searchGmailMessageIds = async (
  accessToken: string,
  query: string,
  maximum = 40,
): Promise<string[]> => {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  const limit = Math.min(Math.max(Math.trunc(maximum), 1), 200);
  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(limit - ids.size, 100)),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{
      messages?: Array<{ id?: string }>;
      nextPageToken?: string;
    }>(`${GMAIL_API}/messages?${params}`, accessToken);
    for (const message of page.messages ?? []) {
      if (message.id) ids.add(message.id);
      if (ids.size >= limit) break;
    }
    pageToken = ids.size < limit ? page.nextPageToken : undefined;
  } while (pageToken);
  return [...ids];
};

export const getGmailMessage = (
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> =>
  googleFetch(
    `${GMAIL_API}/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken,
  );

export const getGmailAttachmentData = async (
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string> => {
  const body = await googleFetch<{ data?: string }>(
    `${GMAIL_API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    accessToken,
  );
  return body.data ?? "";
};
