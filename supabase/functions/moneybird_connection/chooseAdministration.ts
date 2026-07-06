// Pure decision logic for which Moneybird administration a connect request
// binds to (no Deno/Supabase/network imports, unit-testable in Node).
//
// A personal API token can have access to zero, one or several administrations.
// With exactly one the choice is implicit; with several the frontend must let
// the user pick, so we return the list instead of guessing. A requested id
// that the token cannot access is rejected: storing it would produce 401s on
// every later document call.

import type { MoneybirdAdministration } from "../_shared/moneybird/types.ts";

export type AdministrationChoice =
  | { outcome: "chosen"; administration: MoneybirdAdministration }
  | { outcome: "none" }
  | { outcome: "ambiguous"; administrations: MoneybirdAdministration[] }
  | { outcome: "not_accessible" };

export const chooseAdministration = (
  administrations: MoneybirdAdministration[],
  requestedId?: string,
): AdministrationChoice => {
  if (administrations.length === 0) {
    return { outcome: "none" };
  }
  if (requestedId) {
    const match = administrations.find(
      (administration) => administration.id === requestedId,
    );
    return match
      ? { outcome: "chosen", administration: match }
      : { outcome: "not_accessible" };
  }
  if (administrations.length === 1) {
    return { outcome: "chosen", administration: administrations[0] };
  }
  return { outcome: "ambiguous", administrations };
};
