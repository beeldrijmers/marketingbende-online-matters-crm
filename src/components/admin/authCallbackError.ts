/**
 * Supabase error parameters that a failed invite / recovery / OAuth redirect
 * appends to the callback URL (e.g. an expired one-time-password link forwarded
 * by `public/auth-callback.html`).
 */
export type AuthCallbackError = {
  error: string;
  errorCode: string | null;
  errorDescription: string | null;
};

/**
 * Extracts Supabase auth error parameters from a callback URL search string.
 *
 * With hash routing the query lives after the route (`#/auth-callback?error=...`),
 * which react-router surfaces as `location.search`. Returns null when no `error`
 * parameter is present, so callers can fall back to the normal callback flow.
 */
export function getAuthCallbackError(search: string): AuthCallbackError | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const error = params.get("error");

  if (!error) {
    return null;
  }

  return {
    error,
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
  };
}
