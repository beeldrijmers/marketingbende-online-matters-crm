// Error type separating messages that are safe (and useful) to show to the
// end user from internal/technical failures. The HTTP handler shows a
// UserFacingError's message verbatim; anything else becomes a generic Dutch
// message while the technical details stay in the server log and on the
// deal's moneybird_*_error column.
export class UserFacingError extends Error {}

export const userFacingMessage = (error: unknown, fallback: string): string =>
  error instanceof UserFacingError ? error.message : fallback;
