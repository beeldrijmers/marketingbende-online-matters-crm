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

export const listRecentGmailMessageIds = async (
  accessToken: string,
  maximum = 100,
): Promise<string[]> => {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      maxResults: String(Math.min(100, maximum - ids.length)),
      // A bounded first import prevents years of personal mail from flooding
      // the CRM; all later changes are consumed through Gmail history.
      q: "newer_than:30d -in:spam -in:trash",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    }>(`${GMAIL_API}/messages?${params}`, accessToken);
    ids.push(...(page.messages ?? []).map((message) => message.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < maximum);
  return ids.slice(0, maximum);
};

export const listGmailHistoryMessageIds = async (
  accessToken: string,
  startHistoryId: string,
): Promise<{ ids: string[]; historyId: string }> => {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      maxResults: "500",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{
      history?: Array<{
        messagesAdded?: Array<{ message?: { id?: string } }>;
      }>;
      historyId?: string;
      nextPageToken?: string;
    }>(`${GMAIL_API}/history?${params}`, accessToken);
    for (const event of page.history ?? []) {
      for (const addition of event.messagesAdded ?? []) {
        if (addition.message?.id) ids.add(addition.message.id);
      }
    }
    if (page.historyId) latestHistoryId = page.historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { ids: [...ids], historyId: latestHistoryId };
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
