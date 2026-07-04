const sharedSecret = Deno.env.get("TRELLO_WEBHOOK_SHARED_SECRET");
if (!sharedSecret) {
  throw new Error("Missing TRELLO_WEBHOOK_SHARED_SECRET env variable");
}

// Optional: Trello's official HMAC-SHA1 signature scheme
// (https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#validating-the-webhook-request).
// Requires the "Secret" shown next to the Trello API key on
// https://trello.com/power-ups/admin, which is a different value from the
// API key/token pair used for regular REST calls. Only enforced when set.
const apiSecret = Deno.env.get("TRELLO_API_SECRET");

const computeTrelloSignature = async (
  body: string,
  callbackUrl: string,
  secret: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body + callbackUrl),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
};

// Verifies an incoming request against the shared secret placed in the
// registered callback URL's query string (always enforced), and against
// Trello's own HMAC signature when TRELLO_API_SECRET is configured (defense
// in depth once that value is available).
export const verifyTrelloWebhookRequest = async (
  req: Request,
  rawBody: string,
): Promise<boolean> => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== sharedSecret) return false;

  if (apiSecret) {
    const signature = req.headers.get("x-trello-webhook");
    if (!signature) return false;
    const expected = await computeTrelloSignature(rawBody, req.url, apiSecret);
    if (signature !== expected) return false;
  }

  return true;
};
