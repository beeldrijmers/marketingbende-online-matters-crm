import { GoogleApiError } from "./client.ts";

// Keep diagnostics useful without putting mailbox data, message ids or provider
// response bodies in integration runs or GitHub Actions logs.
export type GmailMessageFailureKind =
  | "gmail_api_not_found"
  | "gmail_api_transient"
  | "gmail_api_error"
  | "inbound_server_error"
  | "invalid_message_encoding"
  | "processing_error";

export const isUnavailableGmailMessage = (error: unknown): boolean =>
  error instanceof GoogleApiError && error.status === 404;

export const classifyGmailMessageFailure = (
  error: unknown,
): GmailMessageFailureKind => {
  if (error instanceof GoogleApiError) {
    if (isUnavailableGmailMessage(error)) return "gmail_api_not_found";
    if (error.status >= 500) return "gmail_api_transient";
    return "gmail_api_error";
  }

  if (error instanceof DOMException && error.name === "InvalidCharacterError") {
    return "invalid_message_encoding";
  }

  if (
    error instanceof Error &&
    /^Inbound processing returned 5\d{2}$/.test(error.message)
  ) {
    return "inbound_server_error";
  }

  return "processing_error";
};

export const addGmailMessageFailure = (
  failures: Partial<Record<GmailMessageFailureKind, number>>,
  error: unknown,
): GmailMessageFailureKind => {
  const kind = classifyGmailMessageFailure(error);
  failures[kind] = (failures[kind] ?? 0) + 1;
  return kind;
};
