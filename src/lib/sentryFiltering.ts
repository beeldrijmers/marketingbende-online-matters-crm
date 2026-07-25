/**
 * A cancelled browser request is expected during navigation, tab closure, or
 * query cancellation. It should not become an actionable production error.
 *
 * Keep this deliberately strict: plain objects or strings that merely mention
 * "AbortError" must still reach Sentry.
 */
export const isExpectedAbortError = (exception: unknown): boolean => {
  if (exception instanceof Error) {
    return exception.name === "AbortError";
  }

  return (
    typeof DOMException !== "undefined" &&
    exception instanceof DOMException &&
    exception.name === "AbortError"
  );
};
